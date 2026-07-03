using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MeetingTranscriptionsController : ControllerBase
{
    private readonly IWhisperService _whisperService;
    private readonly IApplicationDbContext _context;

    public MeetingTranscriptionsController(
        IWhisperService whisperService,
        IApplicationDbContext context)
    {
        _whisperService = whisperService;
        _context = context;
    }

    [HttpPost("{reservationId}/upload")]
    public async Task<IActionResult> Upload(int reservationId, IFormFile audio)
    {
        var accessResult = await EnsureReservationAccessAsync(reservationId);
        if (accessResult != null)
        {
            return accessResult;
        }

        try
        {
            var result = await _whisperService.TranscribeAsync(reservationId, audio);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("{reservationId}")]
    public async Task<IActionResult> GetByReservation(int reservationId)
    {
        var accessResult = await EnsureReservationAccessAsync(reservationId);
        if (accessResult != null)
        {
            return accessResult;
        }

        var result = await _whisperService.GetByReservationAsync(reservationId);
        return Ok(result);
    }

    private async Task<IActionResult?> EnsureReservationAccessAsync(int reservationId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var reservation = await _context.RoomReservations
            .AsNoTracking()
            .Where(r => r.Id == reservationId)
            .Select(r => new { r.UserId })
            .FirstOrDefaultAsync();

        if (reservation == null)
        {
            return NotFound("Room reservation not found.");
        }

        if (User.IsInRole("Admin") || User.IsInRole("Manager") || reservation.UserId == userId)
        {
            return null;
        }

        return Forbid();
    }
}
