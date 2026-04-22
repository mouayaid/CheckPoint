namespace PFE.Application.DTOs.Room;

public class RoomDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int Capacity { get; set; }
public bool IsActive { get; set; }
    public string QrData { get; set; } = string.Empty;
}

