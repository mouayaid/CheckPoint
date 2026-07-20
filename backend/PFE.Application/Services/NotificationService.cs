using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.Notification;
using PFE.Domain.Entities;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class NotificationService : INotificationService
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;
    private const int MaxPage = 100000;
    private const int MaxPageSize = 100;

    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationDeliveryQueue _notificationDeliveryQueue;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationDeliveryQueue notificationDeliveryQueue,
        ILogger<NotificationService> logger)
    {
        _context = context;
        _mapper = mapper;
        _notificationDeliveryQueue = notificationDeliveryQueue;
        _logger = logger;
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, int page, int pageSize)
    {
        var safePage = page <= 0
            ? DefaultPage
            : Math.Min(page, MaxPage);
        var safePageSize = pageSize <= 0
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);

        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync();

        return _mapper.Map<List<NotificationDto>>(notifications);
    }

    public async Task<bool> MarkAsReadAsync(int notificationId, int userId)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);

        if (notification == null)
        {
            return false;
        }

        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> MarkAllAsReadAsync(int userId)
    {
        var notifs = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        if (notifs.Count == 0)
            return true;

        foreach (var n in notifs)
            n.IsRead = true;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task RegisterExpoPushTokenAsync(int userId, string expoPushToken)
    {
        var trimmedToken = expoPushToken?.Trim();

        if (!IsValidExpoPushToken(trimmedToken))
        {
            throw new BadRequestException("Invalid Expo push token.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException("User not found.");
        }

        if (user.ExpoPushToken == trimmedToken)
        {
            return;
        }

        user.ExpoPushToken = trimmedToken;
        await _context.SaveChangesAsync();
    }

    public async Task ClearExpoPushTokenAsync(int userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            return;
        }

        user.ExpoPushToken = null;
        await _context.SaveChangesAsync();
    }

    public async Task CreateNotificationAsync(int userId, string title, string message, string type, string? relatedEntityType = null, int? relatedEntityId = null)
    {
        var notification = new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        var expoPushToken = await _context.Users
            .Where(u => u.Id == userId && !string.IsNullOrWhiteSpace(u.ExpoPushToken))
            .Select(u => u.ExpoPushToken)
            .FirstOrDefaultAsync();

        await EnqueueDeliveryAsync(new NotificationDeliveryJob(
            userId,
            _mapper.Map<NotificationDto>(notification),
            title,
            message,
            expoPushToken,
            type,
            relatedEntityType,
            relatedEntityId));
    }

    public async Task CreateNotificationsAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string type,
        string? relatedEntityType = null,
        int? relatedEntityId = null)
    {
        var recipientIds = userIds
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        if (recipientIds.Count == 0)
        {
            return;
        }

        var notifications = recipientIds.Select(userId => new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _context.Notifications.AddRange(notifications);
        await _context.SaveChangesAsync();

        var expoTokensByUserId = await _context.Users
            .Where(u =>
                recipientIds.Contains(u.Id) &&
                !string.IsNullOrWhiteSpace(u.ExpoPushToken))
            .Select(u => new { u.Id, u.ExpoPushToken })
            .ToDictionaryAsync(u => u.Id, u => u.ExpoPushToken);

        var deliveryJobs = notifications.Select(notification =>
            new NotificationDeliveryJob(
                notification.UserId,
                _mapper.Map<NotificationDto>(notification),
                title,
                message,
                expoTokensByUserId.GetValueOrDefault(notification.UserId),
                type,
                relatedEntityType,
                relatedEntityId)).ToList();

        foreach (var job in deliveryJobs)
        {
            await EnqueueDeliveryAsync(job);
        }
    }

    private async Task EnqueueDeliveryAsync(NotificationDeliveryJob job)
    {
        var queued = await _notificationDeliveryQueue.QueueAsync(job);
        if (!queued)
        {
            _logger.LogWarning(
                "Notification delivery queue is full or unavailable. Notification {NotificationId} for user {UserId} was persisted but not queued for SignalR/Expo delivery.",
                job.Notification.Id,
                job.UserId);
        }
    }

    private static bool IsValidExpoPushToken(string? token)
    {
        var trimmed = token?.Trim();
        return !string.IsNullOrWhiteSpace(trimmed) &&
            trimmed.Length <= 256 &&
            !trimmed.Any(char.IsWhiteSpace) &&
            trimmed.EndsWith("]", StringComparison.Ordinal) &&
            (trimmed.StartsWith("ExponentPushToken[", StringComparison.Ordinal) ||
             trimmed.StartsWith("ExpoPushToken[", StringComparison.Ordinal));
    }
}

