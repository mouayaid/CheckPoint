using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class RoomReservation
{
    public int Id { get; set; }
    public int RoomId { get; set; }

    public int? ManagerId { get; set; }
    public User? Manager { get; set; }

    public string? ManagerComment { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public Room Room { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public string Purpose { get; set; } = string.Empty;

    public ReservationStatus Status { get; set; } = ReservationStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
