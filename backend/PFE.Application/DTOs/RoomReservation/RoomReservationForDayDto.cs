using PFE.Domain.Enums;

namespace PFE.Application.DTOs.RoomReservation;

public class RoomReservationForDayDto
{
    public int Id { get; set; }
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public ReservationStatus Status { get; set; }
    public ReservedByDto? ReservedBy { get; set; }
}

public class ReservedByDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
}

