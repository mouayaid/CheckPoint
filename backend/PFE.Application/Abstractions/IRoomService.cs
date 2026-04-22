using PFE.Application.DTOs.Room;
using PFE.Application.DTOs.RoomReservation;

namespace PFE.Application.Abstractions;

public interface IRoomService
{
    Task<List<RoomDto>> GetAllAsync();
    Task<RoomDto?> GetByIdAsync(int id);
    Task<RoomDto> CreateAsync(CreateRoomDto dto);
    Task<RoomDto?> UpdateAsync(int id, UpdateRoomDto dto);
    Task<bool> DeleteAsync(int id);
    Task<RoomDto> GeneratePermanentQrAsync(int id);

    Task<List<RoomReservationDto>> GetUserReservationsAsync(int userId);
    Task CancelReservationAsync(int reservationId, int userId);
}