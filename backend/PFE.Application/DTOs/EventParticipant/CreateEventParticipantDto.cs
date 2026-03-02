using PFE.Domain.Enums;

namespace PFE.Application.DTOs.EventParticipant;

public class CreateEventParticipantDto
{
    public int EventId { get; set; }
    public int UserId { get; set; }
    public ParticipantStatus Status { get; set; } = ParticipantStatus.Pending;
}

