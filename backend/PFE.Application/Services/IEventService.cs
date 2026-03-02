using PFE.Application.DTOs.Event;
using PFE.Application.DTOs.EventParticipant;


namespace PFE.Application.Services;

public interface IEventService
{
    Task<EventDto?> CreateEventAsync(int userId, CreateEventDto dto);
    Task<List<EventDto>> GetEventsByDateAsync(DateTime date);
    Task<EventDto?> GetEventByIdAsync(int eventId);
    Task<EventParticipantDto?> RsvpToEventAsync(int eventId, int userId, RsvpEventDto dto);
}

