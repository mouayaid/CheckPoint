using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class Room
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public RoomType Type { get; set; }
    public int Capacity { get; set; }
public bool IsActive { get; set; } = true;
    public string QrData { get; set; } = string.Empty;
    
    // Navigation properties
    public ICollection<RoomReservation> Reservations { get; set; } = new List<RoomReservation>();
    public ICollection<Event> Events { get; set; } = new List<Event>();
}
