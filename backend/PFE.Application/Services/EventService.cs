using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Event;
using PFE.Application.DTOs.EventParticipant;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class EventService : IEventService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public EventService(IApplicationDbContext context, IMapper mapper, INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<EventDto?> CreateEventAsync(int userId, CreateEventDto dto)
    {
        var creator = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (creator == null)
        {
            return null;
        }

        // Validate room if provided
        if (dto.RoomId.HasValue)
        {
            var roomExists = await _context.Rooms
                .AnyAsync(r => r.Id == dto.RoomId.Value && r.IsActive);
            
            if (!roomExists)
            {
                return null; // Invalid room
            }
        }

        var eventEntity = new Event
        {
            Title = dto.Title,
            Description = dto.Description,
            Type = dto.Type,
            RoomId = dto.RoomId,
            StartDateTime = dto.StartDateTime,
            EndDateTime = dto.EndDateTime,
            CreatedByUserId = userId,
            IsMandatory = dto.IsMandatory,
            RSVPEnabled = dto.RSVPEnabled,
            CreatedAt = DateTime.UtcNow
        };

        _context.Events.Add(eventEntity);
        await _context.SaveChangesAsync();

        var creatorRole = creator.Role.Name;
        var recipientsQuery = _context.Users
            .Include(u => u.Role)
            .Where(u =>
                u.Id != userId &&
                u.IsActive &&
                u.ApprovedAt != null &&
                u.RejectedAt == null);

        if (creatorRole == "Manager")
        {
            recipientsQuery = recipientsQuery.Where(u => u.Role.Name == "Employee");
        }
        else if (creatorRole != "Admin")
        {
            recipientsQuery = recipientsQuery.Where(u => false);
        }

        var recipients = await recipientsQuery.ToListAsync();
        var notificationTitle = dto.IsMandatory ? "Mandatory Event" : "New Event";
        var notificationMessage = dto.IsMandatory
            ? $"New mandatory event: {dto.Title} on {dto.StartDateTime:yyyy-MM-dd HH:mm}"
            : $"New event: {dto.Title} on {dto.StartDateTime:yyyy-MM-dd HH:mm}";
        var notificationType = dto.IsMandatory ? "Warning" : "Info";

        foreach (var recipient in recipients)
        {
            await _notificationService.CreateNotificationAsync(
                recipient.Id,
                notificationTitle,
                notificationMessage,
                notificationType,
                "Event",
                eventEntity.Id);
        }

        // Reload with includes for mapping
        var savedEvent = await _context.Events
            .Include(e => e.CreatedByUser)
            .Include(e => e.Room)
            .Include(e => e.Participants)
            .FirstOrDefaultAsync(e => e.Id == eventEntity.Id);

        return _mapper.Map<EventDto>(savedEvent);
    }

    public async Task<List<EventDto>> GetEventsByDateAsync(DateTime date)
    {
        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

        var events = await _context.Events
            .Include(e => e.CreatedByUser)
            .Include(e => e.Room)
            .Include(e => e.Participants)
            .Where(e => e.StartDateTime >= startOfDay && e.StartDateTime < endOfDay.AddDays(1))
            .OrderBy(e => e.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<EventDto>>(events);
    }

    public async Task<EventDto?> GetEventByIdAsync(int eventId)
    {
        var eventEntity = await _context.Events
            .Include(e => e.CreatedByUser)
            .Include(e => e.Room)
            .Include(e => e.Participants)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null)
        {
            return null;
        }

        return _mapper.Map<EventDto>(eventEntity);
    }

    public async Task<EventParticipantDto?> RsvpToEventAsync(int eventId, int userId, RsvpEventDto dto)
    {
        var eventEntity = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null)
        {
            return null; // Event not found
        }

        if (!eventEntity.RSVPEnabled)
        {
            return null; // RSVP not enabled for this event
        }

        // Check if participant already exists
        var existingParticipant = await _context.EventParticipants
            .FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId);

        if (existingParticipant != null)
        {
            // Update existing RSVP
            existingParticipant.Status = dto.Status;
            existingParticipant.ResponseAt = DateTime.UtcNow;
        }
        else
        {
            // Create new RSVP
            existingParticipant = new EventParticipant
            {
                EventId = eventId,
                UserId = userId,
                Status = dto.Status,
                ResponseAt = DateTime.UtcNow
            };
            _context.EventParticipants.Add(existingParticipant);
        }

        await _context.SaveChangesAsync();

        // Reload with includes for mapping
        var participant = await _context.EventParticipants
            .Include(p => p.Event)
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == existingParticipant.Id);

        return _mapper.Map<EventParticipantDto>(participant);
    }
}
