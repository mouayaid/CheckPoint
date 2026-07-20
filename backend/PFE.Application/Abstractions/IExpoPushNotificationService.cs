namespace PFE.Application.Abstractions;

public interface IExpoPushNotificationService
{
    Task SendToUserAsync(
        int userId,
        string title,
        string body,
        object? data = null,
        CancellationToken cancellationToken = default);

    Task SendToTokenAsync(
        int userId,
        string expoPushToken,
        string title,
        string body,
        object? data = null,
        CancellationToken cancellationToken = default);
}
