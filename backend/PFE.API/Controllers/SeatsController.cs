using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Abstractions;
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
    private readonly IAppTimeProvider _timeProvider;

    public SeatsController(ISeatService seatService, IAppTimeProvider timeProvider)
    {
        _seatService = seatService;
        _timeProvider = timeProvider;
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
            date = _timeProvider.TunisiaToday.ToDateTime(TimeOnly.MinValue);
        }

        var seatMap = await _seatService.GetSeatMapAsync(date);

        return Ok(ApiResponse<List<SeatMapResponseDto>>.SuccessResponse(seatMap));
    }
}

