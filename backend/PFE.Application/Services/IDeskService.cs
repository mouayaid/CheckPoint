using PFE.Application.DTOs.Desk;

namespace PFE.Application.Services;

public interface IDeskService
{
    Task<List<DeskDto>> GetAllDesksAsync();
    Task<DeskReservationDto?> CreateReservationAsync(int userId, CreateDeskReservationDto dto);
    Task<List<DeskReservationDto>> GetUserReservationsAsync(int userId);
    Task<bool> CancelReservationAsync(int reservationId, int userId);
}

