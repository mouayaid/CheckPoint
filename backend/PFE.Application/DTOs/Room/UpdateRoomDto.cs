namespace PFE.Application.DTOs.Room;

public class UpdateRoomDto
{
    public string Name { get; set; } = string.Empty;
    public int Type { get; set; }
    public int Capacity { get; set; }
    public string Location { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
