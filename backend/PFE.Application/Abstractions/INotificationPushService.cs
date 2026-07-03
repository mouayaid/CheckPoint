namespace PFE.Application.Abstractions;

public interface INotificationPushService
{
    Task SendToUserAsync(int userId, object notification);
}