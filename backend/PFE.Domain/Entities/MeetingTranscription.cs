namespace PFE.Domain.Entities;

public class MeetingTranscription
{
    public int Id { get; set; }

    public int RoomReservationId { get; set; }
    public RoomReservation RoomReservation { get; set; } = null!;

    public string AudioFilePath { get; set; } = string.Empty;
    public string TranscriptText { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Tasks { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}