using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;
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

        try
        {
            var result = await _leaveService.CreateLeaveRequestAsync(userId, dto);
            return Ok(ApiResponse<LeaveRequestDto>.SuccessResponse(result, "Leave request created successfully"));
        }
        catch (FrontendValidationException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<LeaveRequestDto>.ErrorResponse(ex.Message, ex.Errors));
        }
    }

    [HttpGet("requests/my")]
    public async Task<ActionResult<ApiResponse<List<LeaveRequestDto>>>> GetMyLeaveRequests()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _leaveService.GetUserLeaveRequestsAsync(userId);

        return Ok(ApiResponse<List<LeaveRequestDto>>.SuccessResponse(requests));
    }

    [Authorize(Roles = "Manager,Admin")]
    [HttpGet("pending-review")]
    public async Task<IActionResult> GetPendingForReview()
    {
        var reviewerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var requests = await _leaveService.GetPendingLeaveRequestsForReviewerAsync(reviewerId);

        return Ok(requests);
    }

    [Authorize(Roles = "Manager,Admin")]
    [HttpPut("requests/{id}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveLeaveRequestDto dto)
    {
        var reviewerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _leaveService.ApproveLeaveRequestAsync(id, reviewerId, dto);

        return Ok(result);
    }

    [Authorize(Roles = "Manager,Admin")]
    [HttpPut("requests/{id}/reject")]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectLeaveRequestDto dto)
    {
        var reviewerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _leaveService.RejectLeaveRequestAsync(id, reviewerId, dto);

        return Ok(result);
    }
}