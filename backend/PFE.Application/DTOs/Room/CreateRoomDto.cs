namespace PFE.Application.DTOs.Room;

public class CreateRoomDto
{
    public string Name { get; set; } = string.Empty;
    public int Type { get; set; }          // or RoomType enum if you have it
    public int Capacity { get; set; }
    public string Location { get; set; } = string.Empty;
}
