using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Leave;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LeaveRequestsController : ControllerBase
{
    private readonly ILeaveRequestService _leaveRequestService;

    public LeaveRequestsController(ILeaveRequestService leaveRequestService)
    {
        _leaveRequestService = leaveRequestService;
    }

    /// <summary>
    /// Create a new leave request (Employee only)
    /// </summary>
    /// <param name="dto">Leave request details</param>
    /// <returns>Created leave request</returns>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<LeaveRequestDto>>> CreateLeaveRequest([FromBody] CreateLeaveRequestDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _leaveRequestService.CreateLeaveRequestAsync(userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<LeaveRequestDto>.ErrorResponse("Failed to create leave request"));
        }

        return Ok(ApiResponse<LeaveRequestDto>.SuccessResponse(result, "Leave request created successfully"));
    }

    /// <summary>
    /// Get current user's leave requests (Employee)
    /// </summary>
    /// <returns>List of user's leave requests</returns>
    [HttpGet("my")]
    public async Task<ActionResult<ApiResponse<List<LeaveRequestDto>>>> GetMyLeaveRequests()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _leaveRequestService.GetUserLeaveRequestsAsync(userId);
        return Ok(ApiResponse<List<LeaveRequestDto>>.SuccessResponse(requests));
    }

    /// <summary>
    /// Get pending leave requests for manager's team (Manager/Admin only)
    /// </summary>
    /// <returns>List of pending leave requests from team members</returns>
    [HttpGet("pending")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<ActionResult<ApiResponse<List<LeaveRequestDto>>>> GetPendingLeaveRequests()
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _leaveRequestService.GetPendingLeaveRequestsForTeamAsync(managerId);
        return Ok(ApiResponse<List<LeaveRequestDto>>.SuccessResponse(requests));
    }
}

