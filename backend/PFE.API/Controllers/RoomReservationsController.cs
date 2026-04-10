using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.RoomReservation;
using PFE.Application.Abstractions;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomReservationsController : ControllerBase
{
    private readonly IRoomReservationService _roomReservationService;

    public RoomReservationsController(IRoomReservationService roomReservationService)
    {
        _roomReservationService = roomReservationService;
    }

    [HttpGet("for-day")]
    public async Task<ActionResult<ApiResponse<List<RoomReservationForDayDto>>>> GetReservationsForDay(
        [FromQuery] int roomId,
        [FromQuery] DateTime? date)
    {
        try
        {
            Console.WriteLine($"[for-day] START roomId={roomId}, date={date}");

            if (roomId <= 0)
            {
                Console.WriteLine("[for-day] invalid roomId");
                return BadRequest(
                    ApiResponse<List<RoomReservationForDayDto>>.ErrorResponse("Invalid roomId.")
                );
            }

            var requestedDate = (date ?? DateTime.Today).Date;
            Console.WriteLine($"[for-day] requestedDate={requestedDate:yyyy-MM-dd}");

            var reservations = await _roomReservationService.GetReservationsForDayAsync(roomId, requestedDate);

            Console.WriteLine($"[for-day] SUCCESS roomId={roomId}, count={reservations.Count}");

            return Ok(ApiResponse<List<RoomReservationForDayDto>>.SuccessResponse(reservations));
        }
        catch (Exception ex)
        {
            Console.WriteLine("[for-day] ERROR:");
            Console.WriteLine(ex.ToString());

            return StatusCode(500,
                ApiResponse<List<RoomReservationForDayDto>>.ErrorResponse($"DEBUG: {ex.Message}")
            );
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<RoomReservationDto>>> CreateReservation(
        [FromBody] CreateRoomReservationDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var reservation = await _roomReservationService.CreateReservationAsync(userId, dto);

        return Ok(ApiResponse<RoomReservationDto>.SuccessResponse(
            reservation!,
            "Room reservation created successfully. Pending approval."
        ));
    }

    [HttpGet("pending")]
    [Authorize(Policy = "ManagerOrAdmin")]
    public async Task<ActionResult<ApiResponse<List<RoomReservationDto>>>> GetPending()
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var pending = await _roomReservationService.GetPendingReservationsAsync(managerId);

        return Ok(ApiResponse<List<RoomReservationDto>>.SuccessResponse(pending));
    }
}