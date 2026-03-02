using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Profile;

public class HistoryItemDto
{
    public string Type { get; set; } = string.Empty; // "SeatReservation", "RoomReservation", "LeaveRequest", "AbsenceRequest", "GeneralRequest"
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // String representation of status enum
    public DateTime CreatedAt { get; set; }
}

