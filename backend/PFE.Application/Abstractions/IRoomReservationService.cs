using PFE.Application.DTOs.RoomReservation;
using PFE.Domain.Enums;

namespace PFE.Application.Abstractions;

public interface IRoomReservationService
{
    Task<List<RoomReservationForDayDto>> GetReservationsForDayAsync(int roomId, DateTime date);
    Task<List<RoomReservationDto>> GetPendingReservationsAsync(int managerUserId);
    Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto);
    Task StartMeetingViaQrAsync(int resId, int scannedRoomId, int userId);
    Task FinishMeetingViaQrAsync(int resId, int scannedRoomId, int userId);
}

