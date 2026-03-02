namespace PFE.Application.DTOs.RoomReservation;

public class CreateRoomReservationDto
{
    public int RoomId { get; set; }

    public string Purpose { get; set; } = string.Empty;

    public DateTime StartDateTime  { get; set; }
    public DateTime EndDateTime  { get; set; }
}

