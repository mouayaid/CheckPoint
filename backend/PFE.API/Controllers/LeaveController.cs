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
public class LeaveController : ControllerBase
{
    private readonly ILeaveService _leaveService;

    public LeaveController(ILeaveService leaveService)
    {
        _leaveService = leaveService;
    }

    [HttpPost("requests")]
    public async Task<ActionResult<ApiResponse<LeaveRequestDto>>> CreateLeaveRequest([FromBody] CreateLeaveRequestDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _leaveService.CreateLeaveRequestAsync(userId, dto);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<LeaveRequestDto>.ErrorResponse("Failed to create leave request"));
        }

        return Ok(ApiResponse<LeaveRequestDto>.SuccessResponse(result, "Leave request created successfully"));
    }

    [HttpGet("requests/my")]
    public async Task<ActionResult<ApiResponse<List<LeaveRequestDto>>>> GetMyLeaveRequests()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _leaveService.GetUserLeaveRequestsAsync(userId);
        return Ok(ApiResponse<List<LeaveRequestDto>>.SuccessResponse(requests));
    }

    [HttpGet("requests/pending")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<ActionResult<ApiResponse<List<LeaveRequestDto>>>> GetPendingLeaveRequests()
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _leaveService.GetPendingLeaveRequestsForManagerAsync(managerId);
        return Ok(ApiResponse<List<LeaveRequestDto>>.SuccessResponse(requests));
    }

    [HttpPut("requests/{id}/review")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ReviewLeaveRequest(int id, [FromBody] ReviewLeaveRequestDto dto)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _leaveService.ReviewLeaveRequestAsync(id, managerId, dto);
        
        if (!result)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Leave request not found or cannot be reviewed"));
        }

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Leave request reviewed successfully"));
    }
}

