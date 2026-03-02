using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Notification;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    /// <summary>
    /// Get all notifications for the logged in user (newest first)
    /// </summary>
    /// <returns>List of notifications</returns>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<NotificationDto>>>> GetNotifications()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var notifications = await _notificationService.GetUserNotificationsAsync(userId);
        return Ok(ApiResponse<List<NotificationDto>>.SuccessResponse(notifications));
    }

    /// <summary>
    /// Mark a notification as read
    /// </summary>
    /// <param name="id">Notification ID</param>
    /// <returns>Success status</returns>
    [HttpPut("{id}/read")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsRead(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _notificationService.MarkAsReadAsync(id, userId);
        
        if (!result)
        {
            return NotFound(ApiResponse<bool>.ErrorResponse("Notification not found"));
        }

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Notification marked as read"));
    }
}

