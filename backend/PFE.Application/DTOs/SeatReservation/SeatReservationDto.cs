using PFE.Domain.Enums;

namespace PFE.Application.DTOs.SeatReservation;

public class SeatReservationDto
{
    public int Id { get; set; }
    public int SeatId { get; set; }
    public string SeatLabel { get; set; } = string.Empty;
    public string OfficeTableName { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public ReservationStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
}

