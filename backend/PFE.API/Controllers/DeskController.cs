using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Desk;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DeskController : ControllerBase
{
    private readonly IDeskService _deskService;

    public DeskController(IDeskService deskService)
    {
        _deskService = deskService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<DeskDto>>>> GetAllDesks()
    {
        var desks = await _deskService.GetAllDesksAsync();
        return Ok(ApiResponse<List<DeskDto>>.SuccessResponse(desks));
    }

    [HttpPost("reservations")]
    public async Task<ActionResult<ApiResponse<DeskReservationDto>>> CreateReservation([FromBody] CreateDeskReservationDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _deskService.CreateReservationAsync(userId, dto);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<DeskReservationDto>.ErrorResponse("Desk not available or already reserved"));
        }

        return Ok(ApiResponse<DeskReservationDto>.SuccessResponse(result, "Reservation created successfully"));
    }

    [HttpGet("reservations/my")]
    public async Task<ActionResult<ApiResponse<List<DeskReservationDto>>>> GetMyReservations()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var reservations = await _deskService.GetUserReservationsAsync(userId);
        return Ok(ApiResponse<List<DeskReservationDto>>.SuccessResponse(reservations));
    }

    [HttpDelete("reservations/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> CancelReservation(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _deskService.CancelReservationAsync(id, userId);
        
        if (!result)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Reservation not found or cannot be cancelled"));
        }

        return Ok(ApiResponse<bool>.SuccessResponse(true, "Reservation cancelled successfully"));
    }
}

