namespace PFE.Application.DTOs.Seat;

public class UpdateSeatDto
{
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

