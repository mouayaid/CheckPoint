namespace PFE.Domain.Entities;

public class Seat
{
    public int Id { get; set; }
    public int OfficeTableId { get; set; }
    public OfficeTable OfficeTable { get; set; } = null!;
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    
    // Navigation properties
    public ICollection<SeatReservation> Reservations { get; set; } = new List<SeatReservation>();
}

