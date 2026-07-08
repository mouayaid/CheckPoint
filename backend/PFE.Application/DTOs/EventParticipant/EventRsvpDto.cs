namespace PFE.Application.DTOs.EventParticipant;

public class EventRsvpDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? RespondedAt { get; set; }
}
