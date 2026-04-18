using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class SeatReservation
{
    public int Id { get; set; }
    public int SeatId { get; set; }
    public Seat Seat { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime Date { get; set; }
    public SeatReservationStatus Status { get; set; } = SeatReservationStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CheckedInAt { get; set; }
}

