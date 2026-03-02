using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.AbsenceRequest;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AbsenceRequestsController : ControllerBase
{
    private readonly IAbsenceRequestService _absenceRequestService;

    public AbsenceRequestsController(IAbsenceRequestService absenceRequestService)
    {
        _absenceRequestService = absenceRequestService;
    }

    /// <summary>
    /// Create a new absence request (Employee only)
    /// </summary>
    /// <param name="dto">Absence request details (date, reason)</param>
    /// <returns>Created absence request</returns>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<AbsenceRequestDto>>> CreateAbsenceRequest([FromBody] CreateAbsenceRequestDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _absenceRequestService.CreateAbsenceRequestAsync(userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<AbsenceRequestDto>.ErrorResponse("Failed to create absence request"));
        }

        return Ok(ApiResponse<AbsenceRequestDto>.SuccessResponse(result, "Absence request created successfully"));
    }

    /// <summary>
    /// Get current user's absence requests (Employee)
    /// </summary>
    /// <returns>List of user's absence requests</returns>
    [HttpGet("my")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestDto>>>> GetMyAbsenceRequests()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _absenceRequestService.GetUserAbsenceRequestsAsync(userId);
        return Ok(ApiResponse<List<AbsenceRequestDto>>.SuccessResponse(requests));
    }

    /// <summary>
    /// Get pending absence requests for manager's team (Manager/Admin only)
    /// </summary>
    /// <returns>List of pending absence requests from team members</returns>
    [HttpGet("pending")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestDto>>>> GetPendingAbsenceRequests()
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _absenceRequestService.GetPendingAbsenceRequestsForTeamAsync(managerId);
        return Ok(ApiResponse<List<AbsenceRequestDto>>.SuccessResponse(requests));
    }
}

