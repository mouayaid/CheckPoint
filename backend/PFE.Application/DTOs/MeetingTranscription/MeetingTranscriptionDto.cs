namespace PFE.Application.DTOs.MeetingTranscription;

public class MeetingTranscriptionDto
{
    public int Id { get; set; }
    public int RoomReservationId { get; set; }
    public string TranscriptText { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Tasks { get; set; }
    public DateTime CreatedAt { get; set; }
}