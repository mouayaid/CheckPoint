using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Seat;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SeatsController : ControllerBase
{
    private readonly ISeatService _seatService;

    public SeatsController(ISeatService seatService)
    {
        _seatService = seatService;
    }

    /// <summary>
    /// Get seat map for a specific date
    /// </summary>
    /// <param name="date">Date in YYYY-MM-DD format</param>
    /// <returns>List of seats with reservation information</returns>
    [HttpGet("map")]
    public async Task<ActionResult<ApiResponse<List<SeatMapResponseDto>>>> GetSeatMap([FromQuery] DateTime date)
    {
        // If no date provided, use today
        if (date == default)
        {
            date = DateTime.Today;
        }

        var seatMap = await _seatService.GetSeatMapAsync(date);

        return Ok(ApiResponse<List<SeatMapResponseDto>>.SuccessResponse(seatMap));
    }
}

