using PFE.Domain.Enums;

namespace PFE.Application.DTOs.RoomReservation;

public class UpdateRoomReservationDto
{
    public DateTime StartDateTime { get; set; }
    public DateTime EndDateTime { get; set; }
    public ReservationStatus Status { get; set; }
}

