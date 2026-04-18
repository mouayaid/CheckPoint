using PFE.Application.DTOs.RoomReservation;
using PFE.Application.DTOs.Room;
namespace PFE.Application.Services;

public interface IRoomService
{
    Task<List<RoomDto>> GetAllRoomsAsync();
    Task<List<RoomReservationDto>> GetAvailableTimeSlotsAsync(int roomId, DateTime date);
    Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto);
    Task<List<RoomReservationDto>> GetUserReservationsAsync(int userId);
    Task CancelReservationAsync(int reservationId, int userId);
    Task<RoomDto?> GetRoomByIdAsync(int id);
    Task<RoomDto> CreateRoomAsync(CreateRoomDto dto);
    Task<RoomDto?> UpdateRoomAsync(int id, UpdateRoomDto dto);
    Task<bool> DeleteRoomAsync(int id);
}

