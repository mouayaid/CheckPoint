namespace PFE.Application.DTOs.Desk;

public class DeskDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public bool IsAvailable { get; set; }
    public string? Description { get; set; }
}

