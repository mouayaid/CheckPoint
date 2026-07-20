using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PFE.Application.DTOs.Event;
using PFE.Application.DTOs.EventParticipant;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;
using System.Text.Json;

namespace PFE.Application.Services;

public class EventService : IEventService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;
    private readonly ILogger<EventService> _logger;
    private readonly IAppTimeProvider _timeProvider;

    public EventService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService,
        ILogger<EventService> logger,
        IAppTimeProvider timeProvider)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public async Task<EventDto?> CreateEventAsync(int userId, CreateEventDto dto)
    {
        var startUtc = NormalizeScheduledInputToUtc(dto.StartDateTime);
        var endUtc = NormalizeScheduledInputToUtc(dto.EndDateTime);

        if (IsInPast(startUtc))
        {
            _logger.LogWarning("CreateEventAsync rejected past start date. UserId={UserId}, Start={Start}", userId, dto.StartDateTime);
            return null;
        }

        if (endUtc <= startUtc)
        {
            _logger.LogWarning(
                "CreateEventAsync rejected invalid range. UserId={UserId}, Start={Start}, End={End}",
                userId,
                dto.StartDateTime,
                dto.EndDateTime);
            return null;
        }

        var creator = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (creator == null)
        {
            return null;
        }

        if (creator.Role.Name != "Admin")
        {
            _logger.LogWarning(
                "CreateEventAsync rejected non-admin creator. UserId={UserId}",
                userId);
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
            StartDateTime = startUtc,
            EndDateTime = endUtc,
            CreatedByUserId = userId,
            IsMandatory = dto.IsMandatory,
            RSVPEnabled = dto.IsMandatory ? false : dto.RSVPEnabled,
            CreatedAt = _timeProvider.UtcNow
        };

        _context.Events.Add(eventEntity);
        await _context.SaveChangesAsync();

        var recipientsQuery = _context.Users
            .Where(u =>
                u.Id != userId &&
                u.IsActive &&
                u.ApprovedAt != null &&
                u.RejectedAt == null);

        var recipientIds = await recipientsQuery
            .Select(u => u.Id)
            .ToListAsync();
        var notificationTitle = dto.IsMandatory ? "Mandatory Event" : "New Event";
        var notificationStart = _timeProvider.ConvertUtcToTunisia(startUtc);
        var notificationMessage = dto.IsMandatory
            ? $"New mandatory event: {dto.Title} on {notificationStart:yyyy-MM-dd HH:mm}"
            : $"New event: {dto.Title} on {notificationStart:yyyy-MM-dd HH:mm}";
        var notificationType = dto.IsMandatory ? "Warning" : "Info";

        await _notificationService.CreateNotificationsAsync(
            recipientIds,
            notificationTitle,
            notificationMessage,
            notificationType,
            "Event",
            eventEntity.Id);

        // Reload with includes for mapping
        var savedEvent = await _context.Events
            .Include(e => e.CreatedByUser)
            .Include(e => e.Room)
            .Include(e => e.Participants)
            .FirstOrDefaultAsync(e => e.Id == eventEntity.Id);

        return _mapper.Map<EventDto>(savedEvent);
    }

    public async Task<List<EventDto>> GetEventsByDateAsync(DateTime date, int? currentUserId = null)
    {
        var startOfTunisiaDay = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
        var endOfTunisiaDay = startOfTunisiaDay.AddDays(1);
        var startUtc = _timeProvider.ConvertTunisiaToUtc(startOfTunisiaDay);
        var endUtc = _timeProvider.ConvertTunisiaToUtc(endOfTunisiaDay);

        var events = await _context.Events
            .Include(e => e.CreatedByUser)
            .Include(e => e.Room)
            .Include(e => e.Participants)
            .Where(e => e.StartDateTime >= startUtc && e.StartDateTime < endUtc)
            .OrderBy(e => e.StartDateTime)
            .ToListAsync();

        return events.Select(e => MapEventDto(e, currentUserId)).ToList();
    }

    public async Task<EventDto?> UpdateEventAsync(
        int eventId,
        int actorUserId,
        bool actorIsAdmin,
        UpdateEventDto dto)
    {
        _logger.LogInformation("UpdateEventAsync started. EventId={EventId}", eventId);

        var startUtc = NormalizeScheduledInputToUtc(dto.StartDateTime);
        var endUtc = NormalizeScheduledInputToUtc(dto.EndDateTime);

        if (IsInPast(startUtc))
        {
            _logger.LogWarning("UpdateEventAsync rejected past start date. EventId={EventId}, Start={Start}", eventId, dto.StartDateTime);
            return null;
        }

        if (endUtc <= startUtc)
        {
            _logger.LogWarning(
                "UpdateEventAsync rejected invalid range. EventId={EventId}, Start={Start}, End={End}",
                eventId,
                dto.StartDateTime,
                dto.EndDateTime);
            return null;
        }

        var eventEntity = await _context.Events
            .Include(e => e.CreatedByUser)
            .Include(e => e.Room)
            .Include(e => e.Participants)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null)
        {
            _logger.LogWarning("UpdateEventAsync could not find event. EventId={EventId}", eventId);
            return null;
        }

        if (!actorIsAdmin)
        {
            _logger.LogWarning(
                "UpdateEventAsync rejected unauthorized actor. EventId={EventId}, ActorUserId={ActorUserId}",
                eventId,
                actorUserId);
            return null;
        }

        _logger.LogInformation("UpdateEventAsync found event. EventId={EventId}", eventId);

        if (dto.RoomId.HasValue)
        {
            var roomExists = await _context.Rooms
                .AnyAsync(r => r.Id == dto.RoomId.Value && r.IsActive);

            if (!roomExists)
            {
                _logger.LogWarning(
                    "UpdateEventAsync rejected invalid room. EventId={EventId}, RoomId={RoomId}",
                    eventId,
                    dto.RoomId.Value);

                return null;
            }
        }

        eventEntity.Title = dto.Title;
        eventEntity.Description = dto.Description;
        eventEntity.Type = dto.Type;
        eventEntity.RoomId = dto.RoomId;
        eventEntity.StartDateTime = startUtc;
        eventEntity.EndDateTime = endUtc;
        eventEntity.IsMandatory = dto.IsMandatory;
        eventEntity.RSVPEnabled = dto.IsMandatory ? false : dto.RSVPEnabled;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UpdateEventAsync failed while saving. EventId={EventId}", eventId);
            throw;
        }

        _logger.LogInformation("UpdateEventAsync saved event. EventId={EventId}", eventId);

        return _mapper.Map<EventDto>(eventEntity);
    }

    public async Task<bool> DeleteEventAsync(int eventId, int actorUserId, bool actorIsAdmin)
    {
        var eventEntity = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null)
        {
            return false;
        }

        if (!actorIsAdmin)
        {
            return false;
        }

        _context.Events.Remove(eventEntity);
        await _context.SaveChangesAsync();
        return true;
    }

    private bool IsInPast(DateTime utcDateTime)
    {
        return utcDateTime < _timeProvider.UtcNow;
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

    public async Task<EventDto?> GetEventByIdAsync(int eventId, int? currentUserId = null)
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

        return MapEventDto(eventEntity, currentUserId);
    }

    public async Task<RsvpEventResult> RsvpToEventAsync(int eventId, int userId, RsvpEventDto dto)
    {
        if (!TryParseRsvpStatus(dto.Status, out var requestedStatus))
        {
            return RsvpEventResult.Fail(
                "InvalidStatus",
                "Invalid RSVP status. Use Going, NotGoing, or Maybe.");
        }

        var eventEntity = await _context.Events
            .Include(e => e.Participants)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (eventEntity == null)
        {
            return RsvpEventResult.Fail("NotFound", "Event not found.");
        }

        if (eventEntity.IsMandatory)
        {
            return RsvpEventResult.Fail(
                "MandatoryEvent",
                "RSVP is not available for mandatory events.");
        }

        if (!eventEntity.RSVPEnabled)
        {
            return RsvpEventResult.Fail(
                "RsvpDisabled",
                "RSVP is not enabled for this event.");
        }

        if (eventEntity.EndDateTime <= _timeProvider.UtcNow)
        {
            return RsvpEventResult.Fail(
                "EventEnded",
                "RSVP is closed for past events.");
        }

        // Check if participant already exists
        var existingParticipant = await _context.EventParticipants
            .FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId);

        if (existingParticipant != null)
        {
            // Update existing RSVP
            existingParticipant.Status = requestedStatus;
            existingParticipant.ResponseAt = _timeProvider.UtcNow;
        }
        else
        {
            // Create new RSVP
            existingParticipant = new EventParticipant
            {
                EventId = eventId,
                UserId = userId,
                Status = requestedStatus,
                ResponseAt = _timeProvider.UtcNow
            };
            _context.EventParticipants.Add(existingParticipant);
        }

        await _context.SaveChangesAsync();

        // Reload with includes for mapping
        var participant = await _context.EventParticipants
            .Include(p => p.Event)
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == existingParticipant.Id);

        return participant == null
            ? RsvpEventResult.Fail("SaveFailed", "Failed to save RSVP response.")
            : RsvpEventResult.Ok(_mapper.Map<EventParticipantDto>(participant));
    }

    public async Task<List<EventRsvpDto>?> GetEventRsvpsAsync(int eventId)
    {
        var eventExists = await _context.Events.AnyAsync(e => e.Id == eventId);

        if (!eventExists)
        {
            return null;
        }

        return await _context.EventParticipants
            .Include(p => p.User)
            .Where(p => p.EventId == eventId)
            .OrderBy(p => p.User.FullName)
            .Select(p => new EventRsvpDto
            {
                UserId = p.UserId,
                FullName = p.User.FullName,
                Email = p.User.Email,
                Status = ToApiRsvpStatus(p.Status),
                RespondedAt = p.ResponseAt
            })
            .ToListAsync();
    }

    private EventDto MapEventDto(Event eventEntity, int? currentUserId = null)
    {
        var dto = _mapper.Map<EventDto>(eventEntity);

        dto.RSVPEnabled = eventEntity.IsMandatory ? false : eventEntity.RSVPEnabled;
        dto.GoingCount = eventEntity.Participants.Count(p => p.Status == ParticipantStatus.Accepted);
        dto.NotGoingCount = eventEntity.Participants.Count(p => p.Status == ParticipantStatus.Declined);
        dto.MaybeCount = eventEntity.Participants.Count(p => p.Status == ParticipantStatus.Maybe);
        dto.ParticipantCount = eventEntity.Participants.Count;

        if (currentUserId.HasValue)
        {
            var currentUserResponse = eventEntity.Participants
                .FirstOrDefault(p => p.UserId == currentUserId.Value);

            dto.CurrentUserRsvpStatus = currentUserResponse == null
                ? null
                : ToApiRsvpStatus(currentUserResponse.Status);
        }

        return dto;
    }

    private static bool TryParseRsvpStatus(JsonElement rawStatus, out ParticipantStatus status)
    {
        status = ParticipantStatus.Pending;

        if (rawStatus.ValueKind == JsonValueKind.Number &&
            rawStatus.TryGetInt32(out var numericStatus) &&
            Enum.IsDefined(typeof(ParticipantStatus), numericStatus))
        {
            status = (ParticipantStatus)numericStatus;
            return status is ParticipantStatus.Accepted
                or ParticipantStatus.Declined
                or ParticipantStatus.Maybe;
        }

        if (rawStatus.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var statusText = rawStatus.GetString();

        if (string.IsNullOrWhiteSpace(statusText))
        {
            return false;
        }

        var normalized = statusText.Trim().Replace("_", string.Empty).Replace("-", string.Empty).ToLowerInvariant();

        switch (normalized)
        {
            case "going":
            case "accepted":
            case "accept":
            case "participer":
            case "participera":
                status = ParticipantStatus.Accepted;
                return true;
            case "notgoing":
            case "declined":
            case "decline":
            case "refused":
            case "nepasparticiper":
                status = ParticipantStatus.Declined;
                return true;
            case "maybe":
            case "peutetre":
            case "peutêtre":
                status = ParticipantStatus.Maybe;
                return true;
            default:
                return false;
        }
    }

    private static string ToApiRsvpStatus(ParticipantStatus status) => status switch
    {
        ParticipantStatus.Accepted => "Going",
        ParticipantStatus.Declined => "NotGoing",
        ParticipantStatus.Maybe => "Maybe",
        _ => "Pending"
    };
}
