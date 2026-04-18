using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Seat;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/seats")]
[Authorize(Roles = "Admin,HR")]
public class AdminSeatsController : ControllerBase
{
    private readonly ISeatService _seatService;

    public AdminSeatsController(ISeatService seatService)
    {
        _seatService = seatService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SeatDto>>>> GetAllSeats()
    {
        var seats = await _seatService.GetAllSeatsAsync();
        return Ok(ApiResponse<List<SeatDto>>.SuccessResponse(seats));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<SeatDto>>> GetSeatById(int id)
    {
        var seat = await _seatService.GetSeatByIdAsync(id);
        if (seat == null)
            return NotFound(ApiResponse<SeatDto>.ErrorResponse("Seat not found"));

        return Ok(ApiResponse<SeatDto>.SuccessResponse(seat));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<SeatDto>>> CreateSeat([FromBody] CreateSeatDto dto)
    {
        var seat = await _seatService.CreateSeatAsync(dto);
        return CreatedAtAction(nameof(GetSeatById), new { id = seat.Id }, ApiResponse<SeatDto>.SuccessResponse(seat, "Seat created successfully"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<SeatDto>>> UpdateSeat(int id, [FromBody] UpdateSeatDto dto)
    {
        var seat = await _seatService.UpdateSeatAsync(id, dto);
        if (seat == null)
            return NotFound(ApiResponse<SeatDto>.ErrorResponse("Seat not found"));

        return Ok(ApiResponse<SeatDto>.SuccessResponse(seat, "Seat updated successfully"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteSeat(int id)
    {
        var deleted = await _seatService.DeleteSeatAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<object>.ErrorResponse("Seat not found"));

        return Ok(ApiResponse<object>.SuccessResponse(null, "Seat deleted successfully"));
    }
}
