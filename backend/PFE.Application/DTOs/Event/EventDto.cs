using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Event;

public class EventDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public EventType Type { get; set; }
    public int? RoomId { get; set; }
    public string? RoomName { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public int CreatedByUserId { get; set; }
    public string CreatedByUserName { get; set; } = string.Empty;
    public bool IsMandatory { get; set; }
    public bool RSVPEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public int ParticipantCount { get; set; }
}
