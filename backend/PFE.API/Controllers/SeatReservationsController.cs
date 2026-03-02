using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
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

        // ✅ Tunisia timezone (Africa/Tunis)
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Africa/Tunis");
        var tunisNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var tunisToday = tunisNow.Date;

        // dto.Date could be DateTime or DateOnly; handle DateTime safely:
        var requestDate = dto.Date.Date;

        if (requestDate != tunisToday)
        {
            return BadRequest(ApiResponse<SeatReservationDto>.ErrorResponse(
                $"Seat reservation is allowed only for today's date (Tunisia): {tunisToday:yyyy-MM-dd}."
            ));
        }

        var result = await _seatReservationService.CreateReservationAsync(userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<SeatReservationDto>.ErrorResponse(
                "Failed to create reservation. Seat may be already reserved, you may already have a reservation for this date, or the seat is inactive."));
        }

        return Ok(ApiResponse<SeatReservationDto>.SuccessResponse(result, "Seat reservation created successfully"));
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
}