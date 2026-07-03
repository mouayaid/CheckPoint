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
    private readonly ILogger<GeneralRequestsController> _logger;

    public GeneralRequestsController(
        IGeneralRequestService generalRequestService,
        ILogger<GeneralRequestsController> logger)
    {
        _generalRequestService = generalRequestService;
        _logger = logger;
    }

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
        _logger.LogInformation("GET /api/GeneralRequests/my entered.");

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        _logger.LogInformation(
            "Extracted authenticated user id claim for general requests. ClaimValue: {UserIdClaim}",
            userIdClaim);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            _logger.LogWarning(
                "Invalid or missing user id claim when retrieving employee general requests. ClaimValue: {UserIdClaim}",
                userIdClaim);

            return Unauthorized(ApiResponse<List<GeneralRequestDto>>.ErrorResponse("Invalid authentication token."));
        }

        var requests = await _generalRequestService.GetUserRequestsAsync(userId);

        _logger.LogInformation(
            "GET /api/GeneralRequests/my returning {RequestCount} requests for UserId: {UserId}",
            requests.Count,
            userId);

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

    [HttpPut("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<GeneralRequestDto>>> ApproveRequest(
        int id,
        [FromBody] UpdateGeneralRequestStatusDto dto)
    {
        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _generalRequestService.ApproveRequestAsync(id, adminId, dto.Comment);

        if (result == null)
        {
            return BadRequest(ApiResponse<GeneralRequestDto>.ErrorResponse(
                "Failed to approve request. Request not found, already reviewed, or you don't have permission."));
        }

        return Ok(ApiResponse<GeneralRequestDto>.SuccessResponse(result, "Request approved successfully"));
    }

    [HttpPut("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<GeneralRequestDto>>> RejectRequest(
        int id,
        [FromBody] UpdateGeneralRequestStatusDto dto)
    {
        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _generalRequestService.RejectRequestAsync(id, adminId, dto.Comment);

        if (result == null)
        {
            return BadRequest(ApiResponse<GeneralRequestDto>.ErrorResponse(
                "Failed to reject request. Request not found, already reviewed, or you don't have permission."));
        }

        return Ok(ApiResponse<GeneralRequestDto>.SuccessResponse(result, "Request rejected successfully"));
    }

    /// <summary>
    /// Update request status (Admin only)
    /// </summary>
    /// <param name="id">Request ID</param>
    /// <param name="dto">Status update details</param>
    /// <returns>Updated request</returns>
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<GeneralRequestDto>>> UpdateRequestStatus(
        int id,
        [FromBody] UpdateGeneralRequestStatusDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _generalRequestService.UpdateRequestStatusAsync(id, userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<GeneralRequestDto>.ErrorResponse(
                "Failed to update status. Only approved or rejected statuses are allowed."));
        }

        return Ok(ApiResponse<GeneralRequestDto>.SuccessResponse(result, "Request status updated successfully"));
    }
}

