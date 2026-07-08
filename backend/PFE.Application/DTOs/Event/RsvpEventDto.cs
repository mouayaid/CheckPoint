using PFE.Application.DTOs.EventParticipant;
using System.Text.Json;

namespace PFE.Application.DTOs.Event;

public class RsvpEventDto
{
    public JsonElement Status { get; set; } // Going, NotGoing, Maybe, or legacy numeric enum
}

public class RsvpEventResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorCode { get; set; }
    public EventParticipantDto? Participant { get; set; }

    public static RsvpEventResult Ok(EventParticipantDto participant) => new()
    {
        Success = true,
        Participant = participant,
        Message = "RSVP updated successfully"
    };

    public static RsvpEventResult Fail(string errorCode, string message) => new()
    {
        Success = false,
        ErrorCode = errorCode,
        Message = message
    };
}

