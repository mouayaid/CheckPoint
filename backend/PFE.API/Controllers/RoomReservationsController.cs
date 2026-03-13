using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.RoomReservation;
using PFE.Application.Abstractions;
using System.Security.Claims;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomReservationsController : ControllerBase
{
    private readonly IRoomReservationService _roomReservationService;
    private readonly IApprovalService _approvalService;

    public RoomReservationsController(IRoomReservationService roomReservationService,
        IApprovalService approvalService)
    {
        _roomReservationService = roomReservationService;
        _approvalService = approvalService;
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

    public class ReviewCommentDto
    {
        public string? Comment { get; set; }
    }

    [HttpPut("{id}/approve")]
    [Authorize(Policy = "ManagerOrAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Approve(int id, [FromBody] ReviewCommentDto? dto)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var ok = await _approvalService.ApproveRoomReservationAsync(id, managerId, dto?.Comment);

        if (!ok)
            return BadRequest(ApiResponse<object>.ErrorResponse("Could not approve reservation."));

        return Ok(ApiResponse<object>.SuccessResponse("Approved", "Reservation approved."));
    }

    [HttpPut("{id}/reject")]
    [Authorize(Policy = "ManagerOrAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Reject(int id, [FromBody] RejectRoomReservationDto dto)
    {
        var managerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var ok = await _approvalService.RejectRoomReservationAsync(id, managerId, dto.Reason);

        if (!ok)
            return BadRequest(ApiResponse<object>.ErrorResponse("Could not reject reservation."));

        return Ok(ApiResponse<object>.SuccessResponse("Rejected", "Reservation rejected."));
    }
}

