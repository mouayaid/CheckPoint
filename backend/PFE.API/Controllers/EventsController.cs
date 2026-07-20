using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Event;
using PFE.Application.DTOs.EventParticipant;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventsController : ControllerBase
{
    private const string PastStartDateMessage = "La date de début ne peut pas être dans le passé.";

    private readonly IEventService _eventService;
    private readonly ILogger<EventsController> _logger;
    private readonly IAppTimeProvider _timeProvider;

    public EventsController(
        IEventService eventService,
        ILogger<EventsController> logger,
        IAppTimeProvider timeProvider)
    {
        _eventService = eventService;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<EventDto>>> CreateEvent([FromBody] CreateEventDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        if (IsInPast(dto.StartDateTime))
        {
            return BadRequest(ApiResponse<EventDto>.ErrorResponse(
                PastStartDateMessage,
                new List<string> { PastStartDateMessage }));
        }

        if (!IsEndAfterStart(dto.StartDateTime, dto.EndDateTime))
        {
            return BadRequest(ApiResponse<EventDto>.ErrorResponse(
                "Event validation failed",
                new List<string> { "End date must be after start date." }));
        }

        var result = await _eventService.CreateEventAsync(userId, dto);

        if (result == null)
        {
            return BadRequest(ApiResponse<EventDto>.ErrorResponse("Failed to create event. Invalid room or other error."));
        }

        return Ok(ApiResponse<EventDto>.SuccessResponse(result, "Event created successfully"));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateEvent(int id, [FromBody] UpdateEventDto dto)
    {
        _logger.LogInformation(
            "Event update request received. EventId={EventId}, Title={Title}, Type={Type}, RoomId={RoomId}, Start={Start}, End={End}",
            id,
            dto.Title,
            dto.Type,
            dto.RoomId,
            dto.StartDateTime,
            dto.EndDateTime);

        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(entry => entry.Value?.Errors.Count > 0)
                .SelectMany(entry => entry.Value!.Errors.Select(error => $"{entry.Key}: {error.ErrorMessage}"))
                .ToList();

            _logger.LogWarning(
                "Event update model validation failed. EventId={EventId}, Errors={Errors}",
                id,
                string.Join(" | ", errors));

            return BadRequest(ApiResponse<EventDto>.ErrorResponse("Event validation failed", errors));
        }

        if (IsInPast(dto.StartDateTime))
        {
            _logger.LogWarning(
                "Event update rejected because start date is in the past. EventId={EventId}, Start={Start}",
                id,
                dto.StartDateTime);

            return BadRequest(ApiResponse<EventDto>.ErrorResponse(
                PastStartDateMessage,
                new List<string> { PastStartDateMessage }));
        }

        if (!IsEndAfterStart(dto.StartDateTime, dto.EndDateTime))
        {
            _logger.LogWarning(
                "Event update rejected because end date is not after start date. EventId={EventId}, Start={Start}, End={End}",
                id,
                dto.StartDateTime,
                dto.EndDateTime);

            return BadRequest(ApiResponse<EventDto>.ErrorResponse(
                "Event validation failed",
                new List<string> { "End date must be after start date." }));
        }

        EventDto? result;

        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            result = await _eventService.UpdateEventAsync(
                id,
                userId,
                User.IsInRole("Admin"),
                dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Event update failed with an exception. EventId={EventId}", id);

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                ApiResponse<EventDto>.ErrorResponse(
                    "Event update failed.",
                    new List<string> { "An unexpected error occurred while saving the event." }));
        }

        if (result == null)
        {
            _logger.LogWarning("Event update returned no result. EventId={EventId}", id);
            return NotFound(ApiResponse<EventDto>.ErrorResponse("Event not found or room is invalid."));
        }

        _logger.LogInformation("Event update succeeded. EventId={EventId}", id);
        return Ok(ApiResponse<EventDto>.SuccessResponse(result, "Event updated successfully"));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteEvent(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var deleted = await _eventService.DeleteEventAsync(
            id,
            userId,
            User.IsInRole("Admin"));

        if (!deleted)
        {
            return NotFound(ApiResponse<string>.ErrorResponse("Event not found or you don't have permission."));
        }

        return Ok(ApiResponse<string>.SuccessResponse("", "Event deleted successfully"));
    }

    private bool IsInPast(DateTime dateTime)
    {
        return NormalizeScheduledInputToUtc(dateTime) < _timeProvider.UtcNow;
    }

    private bool IsEndAfterStart(DateTime startDateTime, DateTime endDateTime)
    {
        return NormalizeScheduledInputToUtc(endDateTime) > NormalizeScheduledInputToUtc(startDateTime);
    }

    private DateTime NormalizeScheduledInputToUtc(DateTime dateTime)
    {
        if (dateTime.Kind == DateTimeKind.Utc)
        {
            return dateTime;
        }

        var tunisiaLocal = DateTime.SpecifyKind(dateTime, DateTimeKind.Unspecified);
        return _timeProvider.ConvertTunisiaToUtc(tunisiaLocal);
    }

    /// <summary>
    /// Get events for a specific date
    /// </summary>
    /// <param name="date">Date in YYYY-MM-DD format</param>
    /// <returns>List of events for that day</returns>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<EventDto>>>> GetEventsByDate([FromQuery] DateTime date)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var events = await _eventService.GetEventsByDateAsync(date, userId);
        return Ok(ApiResponse<List<EventDto>>.SuccessResponse(events));
    }

    /// <summary>
    /// Get event by ID
    /// </summary>
    /// <param name="id">Event ID</param>
    /// <returns>Event details</returns>
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<EventDto>>> GetEventById(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var eventEntity = await _eventService.GetEventByIdAsync(id, userId);

        if (eventEntity == null)
        {
            return NotFound(ApiResponse<EventDto>.ErrorResponse("Event not found"));
        }

        return Ok(ApiResponse<EventDto>.SuccessResponse(eventEntity));
    }

    [HttpGet("{id}/rsvps")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<EventRsvpDto>>>> GetEventRsvps(int id)
    {
        _logger.LogInformation("RSVP list request received. EventId={EventId}", id);

        var rsvps = await _eventService.GetEventRsvpsAsync(id);

        if (rsvps == null)
        {
            _logger.LogWarning("RSVP list event not found. EventId={EventId}", id);
            return NotFound(ApiResponse<List<EventRsvpDto>>.ErrorResponse("Event not found"));
        }

        _logger.LogInformation("RSVP list loaded. EventId={EventId}, Count={Count}", id, rsvps.Count);

        return Ok(ApiResponse<List<EventRsvpDto>>.SuccessResponse(rsvps));
    }

    /// <summary>
    /// RSVP to an event (if RSVP enabled)
    /// </summary>
    /// <param name="id">Event ID</param>
    /// <param name="dto">RSVP status (Accepted = Going, Declined = NotGoing)</param>
    /// <returns>RSVP details</returns>
    [HttpPost("{id}/rsvp")]
    public async Task<ActionResult<ApiResponse<EventParticipantDto>>> RsvpToEvent(
        int id,
        [FromBody] RsvpEventDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _eventService.RsvpToEventAsync(id, userId, dto);

        if (!result.Success || result.Participant == null)
        {
            var response = ApiResponse<EventParticipantDto>.ErrorResponse(
                result.Message,
                new List<string> { result.Message });

            if (result.ErrorCode == "NotFound")
            {
                return NotFound(response);
            }

            return BadRequest(response);
        }

        return Ok(ApiResponse<EventParticipantDto>.SuccessResponse(result.Participant, "RSVP updated successfully"));
    }
}
