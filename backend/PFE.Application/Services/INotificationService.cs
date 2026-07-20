using PFE.Application.DTOs.Notification;
public interface INotificationService
{
    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, int page, int pageSize);
    Task<bool> MarkAsReadAsync(int notificationId, int userId);
    Task<bool> MarkAllAsReadAsync(int userId);
    Task RegisterExpoPushTokenAsync(int userId, string expoPushToken);
    Task ClearExpoPushTokenAsync(int userId);
    Task CreateNotificationAsync(
        int userId,
        string title,
        string message,
        string type,
        string? relatedEntityType = null,
        int? relatedEntityId = null
    );
    Task CreateNotificationsAsync(
        IEnumerable<int> userIds,
        string title,
        string message,
        string type,
        string? relatedEntityType = null,
        int? relatedEntityId = null
    );
}
