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
    var tz = TimeZoneInfo.FindSystemTimeZoneById("W. Central Africa Standard Time"); // Tunisia
    var tunisToday = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;

    var requestedDate = (date?.Date) ?? tunisToday;

    var reservations = await _roomReservationService.GetReservationsForDayAsync(roomId, requestedDate);
    return Ok(ApiResponse<List<RoomReservationForDayDto>>.SuccessResponse(reservations));
}

    [HttpPost]
    public async Task<ActionResult<ApiResponse<RoomReservationDto>>> CreateReservation([FromBody] CreateRoomReservationDto dto)
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

    [HttpPut("{id}/approve")]
    [Authorize(Policy = "ManagerOrAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Approve(int id)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _roomReservationService.ApproveReservationAsync(id, managerId);

        return Ok(ApiResponse<object>.SuccessResponse("Approved", "Reservation approved."));
    }

    [HttpPut("{id}/reject")]
    [Authorize(Policy = "ManagerOrAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Reject(int id, [FromBody] RejectRoomReservationDto dto)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _roomReservationService.RejectReservationAsync(id, managerId, dto.Reason);

        return Ok(ApiResponse<object>.SuccessResponse("Rejected", "Reservation rejected."));
    }
}

