using PFE.Application.DTOs.Event;
using PFE.Application.DTOs.EventParticipant;


namespace PFE.Application.Services;

public interface IEventService
{
    Task<EventDto?> CreateEventAsync(int userId, CreateEventDto dto);
    Task<EventDto?> UpdateEventAsync(int eventId, UpdateEventDto dto);
    Task<List<EventDto>> GetEventsByDateAsync(DateTime date, int? currentUserId = null);
    Task<EventDto?> GetEventByIdAsync(int eventId, int? currentUserId = null);
    Task<RsvpEventResult> RsvpToEventAsync(int eventId, int userId, RsvpEventDto dto);
    Task<List<EventRsvpDto>?> GetEventRsvpsAsync(int eventId);
}

