using PFE.Domain.Enums;

namespace PFE.Application.DTOs.EventParticipant;

public class EventParticipantDto
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string EventTitle { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public ParticipantStatus Status { get; set; }
    public DateTime? ResponseAt { get; set; }
}

