namespace PFE.Domain.Entities;

public class DeskReservation
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int DeskId { get; set; }
    public Desk Desk { get; set; } = null!;
    public DateTime ReservationDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Active"; // Active, Cancelled, Completed
}

