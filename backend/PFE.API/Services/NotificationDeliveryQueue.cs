using System.Threading.Channels;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Notification;

namespace PFE.API.Services;

public sealed class NotificationDeliveryQueue : INotificationDeliveryQueue
{
    private const int QueueCapacity = 1000;
    private static readonly TimeSpan QueueTimeout = TimeSpan.FromSeconds(2);
    private readonly Channel<NotificationDeliveryJob> _queue;
    private readonly ILogger<NotificationDeliveryQueue> _logger;

    public NotificationDeliveryQueue(ILogger<NotificationDeliveryQueue> logger)
    {
        _logger = logger;
        _queue = Channel.CreateBounded<NotificationDeliveryJob>(
            new BoundedChannelOptions(QueueCapacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            });
    }

    public async ValueTask<bool> QueueAsync(
        NotificationDeliveryJob job,
        CancellationToken cancellationToken = default)
    {
        using var timeout = new CancellationTokenSource(QueueTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeout.Token);

        try
        {
            await _queue.Writer.WriteAsync(job, linked.Token);
            return true;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning(
                "Notification delivery queue write timed out for notification {NotificationId} and user {UserId}.",
                job.Notification.Id,
                job.UserId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Notification delivery queue write failed for notification {NotificationId} and user {UserId}.",
                job.Notification.Id,
                job.UserId);
            return false;
        }
    }

    public IAsyncEnumerable<NotificationDeliveryJob> DequeueAllAsync(
        CancellationToken cancellationToken = default) =>
        _queue.Reader.ReadAllAsync(cancellationToken);
}

