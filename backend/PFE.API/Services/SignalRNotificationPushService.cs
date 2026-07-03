using Microsoft.AspNetCore.SignalR;
using PFE.API.Hubs;
using PFE.Application.Abstractions;

namespace PFE.API.Services;

public class SignalRNotificationPushService : INotificationPushService
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public SignalRNotificationPushService(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendToUserAsync(int userId, object notification)
    {
        await _hubContext.Clients
            .Group($"user-{userId}")
            .SendAsync("ReceiveNotification", notification);
    }
}