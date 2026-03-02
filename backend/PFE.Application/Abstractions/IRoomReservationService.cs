using PFE.Application.DTOs.RoomReservation;

namespace PFE.Application.Abstractions;

public interface IRoomReservationService
{
    Task<List<RoomReservationForDayDto>> GetReservationsForDayAsync(int roomId, DateTime date);
    Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto);

    Task<List<RoomReservationDto>> GetPendingReservationsAsync(int managerUserId);
    Task ApproveReservationAsync(int reservationId, int managerUserId);
    Task RejectReservationAsync(int reservationId, int managerUserId, string? reason);

}
