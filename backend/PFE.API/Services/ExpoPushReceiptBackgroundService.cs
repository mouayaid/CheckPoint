using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;

namespace PFE.API.Services;

public sealed class ExpoPushReceiptBackgroundService : BackgroundService
{
    private static readonly TimeSpan ReceiptDelay = TimeSpan.FromSeconds(30);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IExpoPushReceiptQueue _queue;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ILogger<ExpoPushReceiptBackgroundService> _logger;

    public ExpoPushReceiptBackgroundService(
        IExpoPushReceiptQueue queue,
        IHttpClientFactory httpClientFactory,
        IServiceScopeFactory serviceScopeFactory,
        ILogger<ExpoPushReceiptBackgroundService> logger)
    {
        _queue = queue;
        _httpClientFactory = httpClientFactory;
        _serviceScopeFactory = serviceScopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                await Task.Delay(ReceiptDelay, stoppingToken);
                await CheckReceiptAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Expo receipt check failed for ticket {TicketId} and notification {NotificationId}.",
                    job.TicketId,
                    job.NotificationId);
            }
        }
    }

    private async Task CheckReceiptAsync(
        ExpoPushReceiptJob job,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("ExpoPush");
        var response = await client.PostAsJsonAsync(
            "getReceipts",
            new { ids = new[] { job.TicketId } },
            JsonOptions,
            cancellationToken);

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Expo receipt HTTP failure {StatusCode} for ticket {TicketId}. Body: {Body}",
                response.StatusCode,
                job.TicketId,
                Truncate(body));
            return;
        }

        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("data", out var data) ||
            !data.TryGetProperty(job.TicketId, out var receipt))
        {
            _logger.LogWarning(
                "Expo receipt response did not contain ticket {TicketId}.",
                job.TicketId);
            return;
        }

        var status = GetString(receipt, "status");
        if (string.Equals(status, "ok", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation(
                "Expo receipt ok for ticket {TicketId} and notification {NotificationId}.",
                job.TicketId,
                job.NotificationId);
            return;
        }

        var error = GetDetailsError(receipt);
        _logger.LogWarning(
            "Expo receipt error {ExpoError} for ticket {TicketId}, notification {NotificationId}, user {UserId}.",
            error ?? "Unknown",
            job.TicketId,
            job.NotificationId,
            job.UserId);

        if (string.Equals(error, "DeviceNotRegistered", StringComparison.Ordinal))
        {
            await ClearTokenIfCurrentAsync(job.UserId, job.ExpoPushToken, cancellationToken);
        }
    }

    private async Task ClearTokenIfCurrentAsync(
        int userId,
        string expoPushToken,
        CancellationToken cancellationToken)
    {
        using var scope = _serviceScopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var rows = await context.Users
            .Where(u => u.Id == userId && u.ExpoPushToken == expoPushToken)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(u => u.ExpoPushToken, (string?)null),
                cancellationToken);

        if (rows > 0)
        {
            _logger.LogInformation(
                "Cleared DeviceNotRegistered Expo token for user {UserId} from receipt check.",
                userId);
        }
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) &&
        property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private static string? GetDetailsError(JsonElement receipt)
    {
        if (!receipt.TryGetProperty("details", out var details) ||
            details.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return GetString(details, "error");
    }

    private static string Truncate(string value, int maxLength = 500) =>
        value.Length <= maxLength ? value : value[..maxLength];
}

