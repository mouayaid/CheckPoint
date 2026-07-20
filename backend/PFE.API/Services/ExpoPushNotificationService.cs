using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;

namespace PFE.API.Services;

public class ExpoPushNotificationService : IExpoPushNotificationService
{
    private const string NotificationChannelId = "checkpoint-notifications";
    private static readonly Regex ExpoPushTokenPattern = new(
        @"^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IApplicationDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly IExpoPushReceiptQueue _receiptQueue;
    private readonly ILogger<ExpoPushNotificationService> _logger;

    public ExpoPushNotificationService(
        IApplicationDbContext context,
        HttpClient httpClient,
        IExpoPushReceiptQueue receiptQueue,
        ILogger<ExpoPushNotificationService> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _receiptQueue = receiptQueue;
        _logger = logger;
    }

    public async Task SendToUserAsync(
        int userId,
        string title,
        string body,
        object? data = null,
        CancellationToken cancellationToken = default)
    {
        var token = await _context.Users
            .Where(u => u.Id == userId && !string.IsNullOrWhiteSpace(u.ExpoPushToken))
            .Select(u => u.ExpoPushToken)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        await SendToTokenAsync(userId, token, title, body, data, cancellationToken);
    }

    public async Task SendToTokenAsync(
        int userId,
        string expoPushToken,
        string title,
        string body,
        object? data = null,
        CancellationToken cancellationToken = default)
    {
        var token = expoPushToken.Trim();
        var notificationId = TryGetNotificationId(data);

        if (!IsValidExpoPushToken(token))
        {
            _logger.LogWarning(
                "Malformed Expo push token skipped for user {UserId}, notification {NotificationId}. Token: {MaskedToken}",
                userId,
                notificationId,
                MaskToken(token));
            await ClearTokenIfCurrentAsync(userId, token, cancellationToken);
            return;
        }

        var payload = BuildPayload(token, title, body, data);

        try
        {
            _logger.LogInformation(
                "Sending Expo push request for notification {NotificationId}, user {UserId}.",
                notificationId,
                userId);

            var response = await _httpClient.PostAsJsonAsync(
                "send",
                payload,
                JsonOptions,
                cancellationToken);

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Expo push HTTP failure {StatusCode} for notification {NotificationId}, user {UserId}. Body: {Body}",
                    response.StatusCode,
                    notificationId,
                    userId,
                    Truncate(responseBody));
                return;
            }

            await HandleTicketResponseAsync(
                responseBody,
                userId,
                token,
                notificationId,
                cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Expo push request failed for notification {NotificationId}, user {UserId}.",
                notificationId,
                userId);
        }
    }

    private async Task HandleTicketResponseAsync(
        string responseBody,
        int userId,
        string expoPushToken,
        int? notificationId,
        CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(responseBody);
        if (!document.RootElement.TryGetProperty("data", out var data))
        {
            _logger.LogWarning(
                "Expo push response missing data for notification {NotificationId}, user {UserId}.",
                notificationId,
                userId);
            return;
        }

        var tickets = data.ValueKind == JsonValueKind.Array
            ? data.EnumerateArray().ToList()
            : new List<JsonElement> { data };

        var okCount = 0;
        var errorCount = 0;

        foreach (var ticket in tickets)
        {
            var status = GetString(ticket, "status");
            if (string.Equals(status, "ok", StringComparison.OrdinalIgnoreCase))
            {
                okCount++;
                var ticketId = GetString(ticket, "id");
                if (!string.IsNullOrWhiteSpace(ticketId))
                {
                    await _receiptQueue.QueueAsync(
                        new ExpoPushReceiptJob(
                            ticketId,
                            userId,
                            expoPushToken,
                            notificationId),
                        cancellationToken);
                }

                continue;
            }

            errorCount++;
            var error = GetDetailsError(ticket);
            _logger.LogWarning(
                "Expo push ticket error {ExpoError} for notification {NotificationId}, user {UserId}.",
                error ?? "Unknown",
                notificationId,
                userId);

            if (string.Equals(error, "DeviceNotRegistered", StringComparison.Ordinal))
            {
                await ClearTokenIfCurrentAsync(userId, expoPushToken, cancellationToken);
            }
        }

        _logger.LogInformation(
            "Expo push ticket summary for notification {NotificationId}, user {UserId}: {OkCount} ok, {ErrorCount} failed.",
            notificationId,
            userId,
            okCount,
            errorCount);
    }

    private async Task ClearTokenIfCurrentAsync(
        int userId,
        string expoPushToken,
        CancellationToken cancellationToken)
    {
        var rows = await _context.Users
            .Where(u => u.Id == userId && u.ExpoPushToken == expoPushToken)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(u => u.ExpoPushToken, (string?)null),
                cancellationToken);

        if (rows > 0)
        {
            _logger.LogInformation(
                "Cleared invalid Expo token for user {UserId}.",
                userId);
        }
    }

    private static object BuildPayload(
        string expoPushToken,
        string title,
        string body,
        object? data)
    {
        return new
        {
            to = expoPushToken,
            title,
            body,
            data,
            sound = "default",
            priority = "high",
            channelId = NotificationChannelId
        };
    }

    private static bool IsValidExpoPushToken(string? token)
    {
        var trimmed = token?.Trim();
        return !string.IsNullOrWhiteSpace(trimmed) &&
            trimmed.Length <= 256 &&
            ExpoPushTokenPattern.IsMatch(trimmed);
    }

    private static int? TryGetNotificationId(object? data)
    {
        if (data == null) return null;

        var json = JsonSerializer.SerializeToElement(data, JsonOptions);
        if (!json.TryGetProperty("notificationId", out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number &&
            property.TryGetInt32(out var numericId))
        {
            return numericId;
        }

        if (property.ValueKind == JsonValueKind.String &&
            int.TryParse(property.GetString(), out var stringId))
        {
            return stringId;
        }

        return null;
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) &&
        property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private static string? GetDetailsError(JsonElement ticket)
    {
        if (!ticket.TryGetProperty("details", out var details) ||
            details.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetString(details, "error");
    }

    private static string MaskToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return "***";
        return token.Length <= 18 ? "***" : $"{token[..14]}...{token[^6..]}";
    }

    private static string Truncate(string value, int maxLength = 500) =>
        value.Length <= maxLength ? value : value[..maxLength];
}

