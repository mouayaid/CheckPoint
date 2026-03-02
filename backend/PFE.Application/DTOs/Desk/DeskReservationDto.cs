namespace PFE.Application.DTOs.Desk;

public class DeskReservationDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public int DeskId { get; set; }
    public string DeskName { get; set; } = string.Empty;
    public DateTime ReservationDate { get; set; }
    public string Status { get; set; } = string.Empty;
}

