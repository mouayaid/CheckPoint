using PFE.Application.Abstractions;

namespace PFE.API.Services;

public sealed class NotificationDeliveryBackgroundService : BackgroundService
{
    private readonly INotificationDeliveryQueue _queue;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ILogger<NotificationDeliveryBackgroundService> _logger;

    public NotificationDeliveryBackgroundService(
        INotificationDeliveryQueue queue,
        IServiceScopeFactory serviceScopeFactory,
        ILogger<NotificationDeliveryBackgroundService> logger)
    {
        _queue = queue;
        _serviceScopeFactory = serviceScopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in _queue.DequeueAllAsync(stoppingToken))
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var signalR = scope.ServiceProvider.GetRequiredService<INotificationPushService>();
            var expo = scope.ServiceProvider.GetRequiredService<IExpoPushNotificationService>();

            try
            {
                await signalR.SendToUserAsync(job.UserId, job.Notification);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "SignalR notification delivery failed for notification {NotificationId} and user {UserId}.",
                    job.Notification.Id,
                    job.UserId);
            }

            if (string.IsNullOrWhiteSpace(job.ExpoPushToken))
            {
                continue;
            }

            try
            {
                await expo.SendToTokenAsync(
                    job.UserId,
                    job.ExpoPushToken,
                    job.Title,
                    job.Body,
                    new
                    {
                        notificationId = job.Notification.Id,
                        type = job.Type,
                        relatedEntityType = job.RelatedEntityType,
                        relatedEntityId = job.RelatedEntityId
                    },
                    stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Expo notification delivery failed for notification {NotificationId} and user {UserId}.",
                    job.Notification.Id,
                    job.UserId);
            }
        }
    }
}

