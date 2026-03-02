using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Room;
using PFE.Application.Services;
using System.Security.Claims;
using PFE.Application.DTOs.RoomReservation;


namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomController : ControllerBase
{
    private readonly IRoomService _roomService;

    public RoomController(IRoomService roomService)
    {
        _roomService = roomService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RoomDto>>>> GetAllRooms()
    {
        var rooms = await _roomService.GetAllRoomsAsync();
        return Ok(ApiResponse<List<RoomDto>>.SuccessResponse(rooms));
    }

    [HttpGet("{roomId}/availability")]
    public async Task<ActionResult<ApiResponse<List<RoomReservationDto>>>> GetAvailableTimeSlots(int roomId, [FromQuery] DateTime date)
    {
        var reservations = await _roomService.GetAvailableTimeSlotsAsync(roomId, date);
        return Ok(ApiResponse<List<RoomReservationDto>>.SuccessResponse(reservations));
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

