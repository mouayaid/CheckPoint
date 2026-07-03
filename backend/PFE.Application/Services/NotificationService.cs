using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PFE.Application.DTOs.Notification;
using PFE.Domain.Entities;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class NotificationService : INotificationService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationPushService _notificationPushService;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationPushService notificationPushService,
        ILogger<NotificationService> logger)
    {
        _context = context;
        _mapper = mapper;
        _notificationPushService = notificationPushService;
        _logger = logger;
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(int userId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
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

        try
        {
            await _notificationPushService.SendToUserAsync(
                userId,
                _mapper.Map<NotificationDto>(notification));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to push notification {NotificationId} to user {UserId}.",
                notification.Id,
                userId);
        }
    }
}

