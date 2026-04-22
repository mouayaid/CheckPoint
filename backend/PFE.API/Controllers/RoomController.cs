using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Room;
using PFE.Application.Abstractions;
using System.Security.Claims;
using PFE.Application.DTOs.RoomReservation;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomController : ControllerBase
{
    private readonly IRoomService _roomService;
    private readonly IRoomReservationService _roomReservationService;

    public RoomController(
        IRoomService roomService,
        IRoomReservationService roomReservationService)
    {
        _roomService = roomService;
        _roomReservationService = roomReservationService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RoomDto>>>> GetAllRooms()
    {
        var rooms = await _roomService.GetAllAsync();
        return Ok(ApiResponse<List<RoomDto>>.SuccessResponse(rooms));
    }

    [HttpGet("{roomId}/availability")]
    public async Task<ActionResult<ApiResponse<List<RoomReservationForDayDto>>>> GetAvailableTimeSlots(
        int roomId,
        [FromQuery] DateTime date)
    {
        var reservations = await _roomReservationService.GetReservationsForDayAsync(roomId, date);

        return Ok(ApiResponse<List<RoomReservationForDayDto>>.SuccessResponse(reservations));
    }

    [HttpGet("reservations/my")]
    public async Task<ActionResult<ApiResponse<List<RoomReservationDto>>>> GetMyReservations()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var reservations = await _roomService.GetUserReservationsAsync(userId);

        return Ok(ApiResponse<List<RoomReservationDto>>.SuccessResponse(reservations));
    }

    [HttpDelete("reservations/{id}")]
    public async Task<ActionResult<ApiResponse<string>>> CancelReservation(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        await _roomService.CancelReservationAsync(id, userId);

        return Ok(ApiResponse<string>.SuccessResponse(
            "Cancelled",
            "Reservation cancelled successfully"
        ));
    }
}