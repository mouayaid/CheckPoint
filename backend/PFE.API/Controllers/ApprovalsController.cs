using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Approval;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Manager,Admin")]
public class ApprovalsController : ControllerBase
{
    private readonly IApprovalService _approvalService;

    public ApprovalsController(IApprovalService approvalService)
    {
        _approvalService = approvalService;
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
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        bool result;
        if (dto.Decision.ToLower() == "approve")
        {
            result = await _approvalService.ApproveLeaveRequestAsync(id, managerId, dto.Comment);
        }
        else if (dto.Decision.ToLower() == "reject")
        {
            result = await _approvalService.RejectLeaveRequestAsync(id, managerId, dto.Comment);
        }
        else
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Decision must be 'approve' or 'reject'"));
        }

        if (!result)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(
                "Failed to process request. Request not found, already processed, or you don't have permission to approve requests from this department."));
        }

        var action = dto.Decision.ToLower() == "approve" ? "approved" : "rejected";
        return Ok(ApiResponse<bool>.SuccessResponse(true, $"Leave request {action} successfully"));
    }

    /// <summary>
    /// Approve or reject an absence request
    /// </summary>
    /// <param name="id">Absence request ID</param>
    /// <param name="dto">Decision (approve/reject) and optional comment</param>
    /// <returns>Success status</returns>
    [HttpPut("absence/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> ApproveAbsenceRequest(
        int id,
        [FromBody] ApprovalDecisionDto dto)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        bool result;
        if (dto.Decision.ToLower() == "approve")
        {
            result = await _approvalService.ApproveAbsenceRequestAsync(id, managerId, dto.Comment);
        }
        else if (dto.Decision.ToLower() == "reject")
        {
            result = await _approvalService.RejectAbsenceRequestAsync(id, managerId, dto.Comment);
        }
        else
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Decision must be 'approve' or 'reject'"));
        }

        if (!result)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(
                "Failed to process request. Request not found, already processed, or you don't have permission to approve requests from this department."));
        }

        var action = dto.Decision.ToLower() == "approve" ? "approved" : "rejected";
        return Ok(ApiResponse<bool>.SuccessResponse(true, $"Absence request {action} successfully"));
    }

    /// <summary>
    /// Approve or reject a room reservation
    /// </summary>
    /// <param name="id">Room reservation ID</param>
    /// <param name="dto">Decision (approve/reject) and optional comment</param>
    /// <returns>Success status</returns>
    [HttpPut("room/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> ApproveRoomReservation(
        int id,
        [FromBody] ApprovalDecisionDto dto)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        bool result;
        if (dto.Decision.ToLower() == "approve")
        {
            result = await _approvalService.ApproveRoomReservationAsync(id, managerId, dto.Comment);
        }
        else if (dto.Decision.ToLower() == "reject")
        {
            result = await _approvalService.RejectRoomReservationAsync(id, managerId, dto.Comment);
        }
        else
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Decision must be 'approve' or 'reject'"));
        }

        if (!result)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(
                "Failed to process reservation. Reservation not found, already processed, time slot is now occupied, or you don't have permission to approve reservations from this department."));
        }

        var action = dto.Decision.ToLower() == "approve" ? "approved" : "rejected";
        return Ok(ApiResponse<bool>.SuccessResponse(true, $"Room reservation {action} successfully"));
    }
}

