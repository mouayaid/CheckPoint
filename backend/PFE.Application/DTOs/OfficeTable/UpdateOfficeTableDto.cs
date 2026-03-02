namespace PFE.Application.DTOs.OfficeTable;

public class UpdateOfficeTableDto
{
    public string Name { get; set; } = string.Empty;
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
}

