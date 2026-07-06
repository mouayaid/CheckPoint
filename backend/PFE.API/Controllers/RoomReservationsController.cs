using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;
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
    [Authorize(Roles = "Manager,Admin")]
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

            var reservations = await _roomReservationService.GetReservationsForDayAsync(
                roomId,
                requestedDate
            );

            return Ok(
                ApiResponse<List<RoomReservationForDayDto>>.SuccessResponse(
                    reservations,
                    "Reservations retrieved successfully."
                )
            );
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                ApiResponse<List<RoomReservationForDayDto>>.ErrorResponse(
                    "Failed to retrieve reservations.",
                    new List<string> { ex.Message }
                )
            );
        }
    }

    [HttpPost]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult<ApiResponse<RoomReservationDto>>> CreateReservation(
        [FromBody] CreateRoomReservationDto dto)
    {
        try
        {
            var creatorUserId = int.Parse(
                User.FindFirst(ClaimTypes.NameIdentifier)!.Value
            );

            var reservation = await _roomReservationService.CreateReservationAsync(
                creatorUserId,
                dto
            );

            return Ok(
                ApiResponse<RoomReservationDto>.SuccessResponse(
                    reservation,
                    "Room reservation created successfully."
                )
            );
        }
        catch (ConflictException ex)
        {
            return Conflict(
                ApiResponse<RoomReservationDto>.ErrorResponse(
                    "Selected time slot is unavailable.",
                    new List<string> { ex.Message }
                )
            );
        }
        catch (Exception ex)
        {
            return BadRequest(
                ApiResponse<RoomReservationDto>.ErrorResponse(
                    "Failed to create room reservation.",
                    new List<string> { ex.Message }
                )
            );
        }
    }

    [HttpPost("{id}/scan-start")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult<ApiResponse<object>>> ScanStart(
        [FromRoute] int id,
        [FromBody] ScanRoomDto dto)
    {
        try
        {
            var scannerUserId = int.Parse(
                User.FindFirst(ClaimTypes.NameIdentifier)!.Value
            );

            await _roomReservationService.StartMeetingViaQrAsync(
                id,
                dto.ScannedRoomId,
                scannerUserId
            );

            return Ok(
                ApiResponse<object>.SuccessResponse(
                    null,
                    "Meeting started successfully."
                )
            );
        }
        catch (NotFoundException ex)
        {
            return NotFound(ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (BadRequestException ex)
        {
            return BadRequest(
                ApiResponse<object>.ErrorResponse(
                    "Failed to start meeting.",
                    new List<string> { ex.Message }
                )
            );
        }
    }

    [HttpPost("{id}/finish")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult<ApiResponse<object>>> FinishMeeting(
        [FromRoute] int id)
    {
        try
        {
            var userId = int.Parse(
                User.FindFirst(ClaimTypes.NameIdentifier)!.Value
            );

            await _roomReservationService.FinishMeetingAsync(id, userId);

            return Ok(
                ApiResponse<object>.SuccessResponse(
                    null,
                    "Meeting completed successfully."
                )
            );
        }
        catch (NotFoundException ex)
        {
            return NotFound(
                ApiResponse<object>.ErrorResponse(
                    "Reservation not found.",
                    new List<string> { ex.Message }
                )
            );
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (ConflictException ex)
        {
            return Conflict(
                ApiResponse<object>.ErrorResponse(
                    "Failed to finish meeting.",
                    new List<string> { ex.Message }
                )
            );
        }
        catch (BadRequestException ex)
        {
            return BadRequest(
                ApiResponse<object>.ErrorResponse(
                    "Failed to finish meeting.",
                    new List<string> { ex.Message }
                )
            );
        }
    }

    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult<ApiResponse<object>>> CancelReservation(
    [FromRoute] int id)
    {
        try
        {
            var userId = int.Parse(
                User.FindFirst(ClaimTypes.NameIdentifier)!.Value
            );

            await _roomReservationService.CancelReservationAsync(id, userId);

            return Ok(
                ApiResponse<object>.SuccessResponse(
                    null,
                    "Room reservation cancelled successfully."
                )
            );
        }
        catch (NotFoundException ex)
        {
            return NotFound(ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, ApiResponse<object>.ErrorResponse(ex.Message));
        }
        catch (BadRequestException ex)
        {
            return BadRequest(
                ApiResponse<object>.ErrorResponse(
                    "Failed to cancel room reservation.",
                    new List<string> { ex.Message }
                )
            );
        }
    }
}
