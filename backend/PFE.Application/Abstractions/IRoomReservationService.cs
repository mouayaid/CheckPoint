using PFE.Application.DTOs.RoomReservation;

namespace PFE.Application.Abstractions;

public interface IRoomReservationService
{
    Task<List<RoomReservationForDayDto>> GetReservationsForDayAsync(int roomId, DateTime date);
    Task<RoomReservationDto> CreateReservationAsync(int userId, CreateRoomReservationDto dto);
    Task StartMeetingViaQrAsync(int reservationId, int scannedRoomId, int scannerUserId);
    Task FinishMeetingAsync(int reservationId, int userId);
    Task CancelReservationAsync(int reservationId, int userId);
}

