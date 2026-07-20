using PFE.Application.DTOs.Notification;

namespace PFE.Application.Abstractions;

public interface INotificationDeliveryQueue
{
    ValueTask<bool> QueueAsync(
        NotificationDeliveryJob job,
        CancellationToken cancellationToken = default);

    IAsyncEnumerable<NotificationDeliveryJob> DequeueAllAsync(
        CancellationToken cancellationToken = default);
}

