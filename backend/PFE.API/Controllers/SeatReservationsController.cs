using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.SeatReservation;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SeatReservationsController : ControllerBase
{
    private readonly ISeatReservationService _seatReservationService;

    public SeatReservationsController(ISeatReservationService seatReservationService)
    {
        _seatReservationService = seatReservationService;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<SeatReservationDto>>> CreateReservation([FromBody] SeatReservationCreateDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        try
        {
            var result = await _seatReservationService.CreateReservationAsync(userId, dto);
            return Ok(ApiResponse<SeatReservationDto>.SuccessResponse(result, "Seat reservation created successfully"));
        }
        catch (FrontendValidationException ex)
        {
            return StatusCode(ex.StatusCode, ApiResponse<SeatReservationDto>.ErrorResponse(ex.Message, ex.Errors));
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> CancelReservation(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var userRole = User.FindFirst(ClaimTypes.Role)!.Value;

        var result = await _seatReservationService.CancelReservationAsync(id, userId, userRole);

        if (!result)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(
                "Failed to cancel reservation. Reservation not found, you don't have permission, or reservation is not active."));
        }

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Seat reservation cancelled successfully"));
    }

    [HttpDelete("my-today")]
    public async Task<ActionResult<ApiResponse<bool>>> CancelMyTodayReservation()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var cancelled = await _seatReservationService.CancelMyTodayReservationAsync(userId);

        if (!cancelled)
        {
            return NotFound(ApiResponse<bool>.ErrorResponse(
                "No active desk reservation found for today."));
        }

        return Ok(ApiResponse<bool>.SuccessResponse(
            true,
            "Desk reservation cancelled successfully"));
    }

    [HttpGet("my-today")]
    public async Task<ActionResult<ApiResponse<SeatReservationDto?>>> GetMyTodayReservation()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _seatReservationService.GetMyTodayReservationAsync(userId);

        return Ok(ApiResponse<SeatReservationDto?>.SuccessResponse(result,
            result == null ? "No seat reservation for today." : "Today's seat reservation fetched successfully."));
    }
}