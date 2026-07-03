using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace PFE.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?
            .FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var departmentId = Context.User?
            .FindFirst("DepartmentId")?.Value;

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                $"user-{userId}"
            );
        }

        if (!string.IsNullOrEmpty(departmentId))
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                $"department-{departmentId}"
            );
        }

        await base.OnConnectedAsync();
    }
}