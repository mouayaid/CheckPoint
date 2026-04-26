using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class RoomReservation
{
    public int Id { get; set; }

    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int? ManagerId { get; set; }
    public User? Manager { get; set; }

    public string? ManagerComment { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public string Purpose { get; set; } = string.Empty;

    public ReservationStatus Status { get; set; } = ReservationStatus.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime? StartedAt { get; set; }
    public int? StartedById { get; set; }
    public User? StartedBy { get; set; }

    public DateTime? EndedAt { get; set; }
    public int? EndedById { get; set; }
    public User? EndedBy { get; set; }
}