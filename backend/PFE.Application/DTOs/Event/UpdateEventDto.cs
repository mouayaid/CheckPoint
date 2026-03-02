using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Event;

public class UpdateEventDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public EventType Type { get; set; }
    public int? RoomId { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public bool IsMandatory { get; set; }
}

