using System.Threading.Channels;

namespace PFE.API.Services;

public sealed record ExpoPushReceiptJob(
    string TicketId,
    int UserId,
    string ExpoPushToken,
    int? NotificationId);

public interface IExpoPushReceiptQueue
{
    ValueTask<bool> QueueAsync(
        ExpoPushReceiptJob job,
        CancellationToken cancellationToken = default);

    IAsyncEnumerable<ExpoPushReceiptJob> DequeueAllAsync(
        CancellationToken cancellationToken = default);
}

public sealed class ExpoPushReceiptQueue : IExpoPushReceiptQueue
{
    private const int QueueCapacity = 1000;
    private readonly Channel<ExpoPushReceiptJob> _queue;
    private readonly ILogger<ExpoPushReceiptQueue> _logger;

    public ExpoPushReceiptQueue(ILogger<ExpoPushReceiptQueue> logger)
    {
        _logger = logger;
        _queue = Channel.CreateBounded<ExpoPushReceiptJob>(
            new BoundedChannelOptions(QueueCapacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            });
    }

    public async ValueTask<bool> QueueAsync(
        ExpoPushReceiptJob job,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var queued = _queue.Writer.TryWrite(job);
            if (!queued)
            {
                _logger.LogWarning(
                    "Expo receipt queue is full. Receipt {TicketId} for notification {NotificationId} was not queued.",
                    job.TicketId,
                    job.NotificationId);
            }

            await Task.CompletedTask;
            return queued;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Expo receipt queue write failed for receipt {TicketId}.",
                job.TicketId);
            return false;
        }
    }

    public IAsyncEnumerable<ExpoPushReceiptJob> DequeueAllAsync(
        CancellationToken cancellationToken = default) =>
        _queue.Reader.ReadAllAsync(cancellationToken);
}
