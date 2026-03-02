using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Event;

public class RsvpEventDto
{
    public ParticipantStatus Status { get; set; } // Accepted = Going, Declined = NotGoing
}

