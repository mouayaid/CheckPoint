namespace PFE.Domain.Entities;

public class Desk
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int X { get; set; } // X coordinate in 2D layout
    public int Y { get; set; } // Y coordinate in 2D layout
    public bool IsAvailable { get; set; } = true;
    public string? Description { get; set; }
    
    // Navigation properties
    public ICollection<DeskReservation> Reservations { get; set; } = new List<DeskReservation>();
}

