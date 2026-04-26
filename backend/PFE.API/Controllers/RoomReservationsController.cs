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
    [Authorize(Roles = "HR,Manager,Admin")]
    public async Task<ActionResult<ApiResponse<List<RoomReservationForDayDto>>>> GetReservationsForDay(
        [FromQuery] int roomId,
        [FromQuery] DateTime? date)
    {
        try
        {
            if (roomId <= 0)
            {
                return BadRequest(
                    ApiResponse<List<RoomReservationForDayDto>>.ErrorResponse("Invalid roomId.")
                );
            }

            var requestedDate = (date ?? DateTime.Today).Date;
            var reservations = await _roomReservationService.GetReservationsForDayAsync(roomId, requestedDate);

            return Ok(ApiResponse<List<RoomReservationForDayDto>>.SuccessResponse(reservations));
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                ApiResponse<List<RoomReservationForDayDto>>.ErrorResponse(ex.Message)
            );
        }
    }

    [HttpPost]
    [Authorize(Roles = "HR,Manager,Admin")]
    public async Task<ActionResult<ApiResponse<RoomReservationDto>>> CreateReservation(
        [FromBody] CreateRoomReservationDto dto)
    {
        var creatorUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var reservation = await _roomReservationService.CreateReservationAsync(creatorUserId, dto);

        return Ok(ApiResponse<RoomReservationDto>.SuccessResponse(
            reservation!,
            "Room reservation created successfully."
        ));
    }

    [HttpPost("{id}/scan-start")]
    [Authorize(Roles = "HR,Manager,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> ScanStart(
        [FromRoute] int id,
        [FromBody] ScanRoomDto dto)
    {
        var scannerUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        await _roomReservationService.StartMeetingViaQrAsync(id, dto.ScannedRoomId, scannerUserId);

        return Ok(ApiResponse<object>.SuccessResponse(
            new { message = "Meeting started successfully." }
        ));
    }

    [HttpPost("{id}/scan-finish")]
    [Authorize(Roles = "HR,Manager,Admin")]
    public async Task<ActionResult<ApiResponse<object>>> ScanFinish(
        [FromRoute] int id,
        [FromBody] ScanRoomDto dto)
    {
        var scannerUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        await _roomReservationService.FinishMeetingViaQrAsync(id, dto.ScannedRoomId, scannerUserId);

        return Ok(ApiResponse<object>.SuccessResponse(
            new { message = "Meeting completed successfully." }
        ));
    }
}