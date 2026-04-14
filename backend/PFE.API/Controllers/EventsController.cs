using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
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
    private readonly IEventService _eventService;

    public EventsController(IEventService eventService)
    {
        _eventService = eventService;
    }

    /// <summary>
    /// Create a new event (Manager/Admin only)
    /// </summary>
    /// <param name="dto">Event details</param>
    /// <returns>Created event</returns>
    [HttpPost]
    [Authorize(Roles = "Manager,Admin,HR")]
    public async Task<ActionResult<ApiResponse<EventDto>>> CreateEvent([FromBody] CreateEventDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _eventService.CreateEventAsync(userId, dto);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<EventDto>.ErrorResponse("Failed to create event. Invalid room or other error."));
        }

        return Ok(ApiResponse<EventDto>.SuccessResponse(result, "Event created successfully"));
    }

    /// <summary>
    /// Get events for a specific date
    /// </summary>
    /// <param name="date">Date in YYYY-MM-DD format</param>
    /// <returns>List of events for that day</returns>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<EventDto>>>> GetEventsByDate([FromQuery] DateTime date)
    {
        var events = await _eventService.GetEventsByDateAsync(date);
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
        var eventEntity = await _eventService.GetEventByIdAsync(id);
        
        if (eventEntity == null)
        {
            return NotFound(ApiResponse<EventDto>.ErrorResponse("Event not found"));
        }

        return Ok(ApiResponse<EventDto>.SuccessResponse(eventEntity));
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
        
        if (result == null)
        {
            return BadRequest(ApiResponse<EventParticipantDto>.ErrorResponse(
                "Failed to RSVP. Event not found or RSVP not enabled for this event."));
        }

        return Ok(ApiResponse<EventParticipantDto>.SuccessResponse(result, "RSVP updated successfully"));
    }
}

