namespace PFE.Application.DTOs.Seat;

public class SeatDto
{
    public int Id { get; set; }
    public int OfficeTableId { get; set; }
    public string OfficeTableName { get; set; } = string.Empty;
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

