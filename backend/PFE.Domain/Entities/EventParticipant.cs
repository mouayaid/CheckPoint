using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class EventParticipant
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public Event Event { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public ParticipantStatus Status { get; set; } = ParticipantStatus.Pending;
    public DateTime? ResponseAt { get; set; }
}

