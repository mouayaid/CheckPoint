using PFE.Application.DTOs.Notification;
public interface INotificationService
{
    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId);
    Task<bool> MarkAsReadAsync(int notificationId, int userId);
    Task<bool> MarkAllAsReadAsync(int userId);
    Task CreateNotificationAsync(
        int userId,
        string title,
        string message,
        string type,
        string? relatedEntityType = null,
        int? relatedEntityId = null
    );
}