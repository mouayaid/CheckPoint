using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Approval;
using PFE.Application.DTOs.Leave;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class ApprovalsController : ControllerBase
{
    private readonly ILeaveService _leaveService;

    public ApprovalsController(ILeaveService leaveService)
    {
        _leaveService = leaveService;
    }

    /// <summary>
    /// Approve or reject a leave request
    /// </summary>
    /// <param name="id">Leave request ID</param>
    /// <param name="dto">Decision (approve/reject) and optional comment</param>
    /// <returns>Success status</returns>
    [HttpPut("leave/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> ApproveLeaveRequest(
        int id,
        [FromBody] ApprovalDecisionDto dto)
    {
        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        object? result;
        if (dto.Decision.ToLower() == "approve")
        {
            result = await _leaveService.ApproveLeaveRequestAsync(
                id,
                adminId,
                new ApproveLeaveRequestDto
                {
                    Comment = dto.Comment,
                    DeductFromLeaveBalance = true
                });
        }
        else if (dto.Decision.ToLower() == "reject")
        {
            result = await _leaveService.RejectLeaveRequestAsync(
                id,
                adminId,
                new RejectLeaveRequestDto { Comment = dto.Comment ?? string.Empty });
        }
        else
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Decision must be 'approve' or 'reject'"));
        }

        if (result == null)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(
                "Failed to process request. Request not found, already processed, or you don't have permission to approve requests from this department."));
        }

        var action = dto.Decision.ToLower() == "approve" ? "approved" : "rejected";
        return Ok(ApiResponse<bool>.SuccessResponse(true, $"Leave request {action} successfully"));
    }

    // Room reservation approvals are deprecated. Reservations are confirmed immediately
    // when the requested slot is available.
}

