using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.GeneralRequest;
using PFE.Application.Services;
using PFE.Domain.Enums;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GeneralRequestsController : ControllerBase
{
    private readonly IGeneralRequestService _generalRequestService;

    public GeneralRequestsController(IGeneralRequestService generalRequestService)
    {
        _generalRequestService = generalRequestService;
    }

    /// <summary>
    /// Create a new general request (Employee)
    /// </summary>
    /// <param name="dto">Request details (Category: HR/IT/Admin)</param>
    /// <returns>Created request</returns>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<GeneralRequestDto>>> CreateRequest([FromBody] CreateGeneralRequestDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _generalRequestService.CreateRequestAsync(userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<GeneralRequestDto>.ErrorResponse("Failed to create request"));
        }

        return Ok(ApiResponse<GeneralRequestDto>.SuccessResponse(result, "Request created successfully"));
    }

    /// <summary>
    /// Get current user's requests (Employee)
    /// </summary>
    /// <returns>List of user's requests</returns>
    [HttpGet("my")]
    public async Task<ActionResult<ApiResponse<List<GeneralRequestDto>>>> GetMyRequests()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _generalRequestService.GetUserRequestsAsync(userId);
        return Ok(ApiResponse<List<GeneralRequestDto>>.SuccessResponse(requests));
    }

    /// <summary>
    /// Get all requests with optional filters (Admin only)
    /// </summary>
    /// <param name="status">Filter by status (optional)</param>
    /// <param name="category">Filter by category (optional)</param>
    /// <returns>List of requests</returns>
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<GeneralRequestDto>>>> GetAllRequests(
        [FromQuery] RequestStatus? status,
        [FromQuery] RequestCategory? category)
    {
        var requests = await _generalRequestService.GetAllRequestsAsync(status, category);
        return Ok(ApiResponse<List<GeneralRequestDto>>.SuccessResponse(requests));
    }

    /// <summary>
    /// Assign request to a user (Admin only)
    /// </summary>
    /// <param name="id">Request ID</param>
    /// <param name="dto">Assignment details</param>
    /// <returns>Updated request</returns>
    [HttpPut("{id}/assign")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<GeneralRequestDto>>> AssignRequest(
        int id,
        [FromBody] AssignGeneralRequestDto dto)
    {
        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _generalRequestService.AssignRequestAsync(id, adminId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<GeneralRequestDto>.ErrorResponse("Failed to assign request. Request not found."));
        }

        return Ok(ApiResponse<GeneralRequestDto>.SuccessResponse(result, "Request assigned successfully"));
    }

    /// <summary>
    /// Update request status (Requester, Assigned User, or Admin)
    /// </summary>
    /// <param name="id">Request ID</param>
    /// <param name="dto">Status update details</param>
    /// <returns>Updated request</returns>
    [HttpPut("{id}/status")]
    public async Task<ActionResult<ApiResponse<GeneralRequestDto>>> UpdateRequestStatus(
        int id,
        [FromBody] UpdateGeneralRequestStatusDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _generalRequestService.UpdateRequestStatusAsync(id, userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<GeneralRequestDto>.ErrorResponse(
                "Failed to update status. Request not found or you don't have permission."));
        }

        return Ok(ApiResponse<GeneralRequestDto>.SuccessResponse(result, "Request status updated successfully"));
    }
}

