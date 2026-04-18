using PFE.Application.DTOs.SeatReservation;
namespace PFE.Application.Services;

public interface ISeatReservationService
{
    Task<SeatReservationDto?> CreateReservationAsync(int userId, SeatReservationCreateDto dto);
    Task<bool> CancelReservationAsync(int reservationId, int userId, string userRole);
    Task<SeatReservationDto?> GetMyTodayReservationAsync(int userId);

    Task<SeatReservationDto> CheckInAsync(int userId, SeatCheckInDto dto);
    Task<List<MonthCheckInDto>> GetMyMonthReservationsAsync(int userId, int year, int month);

    Task<bool> CancelMyTodayReservationAsync(int userId);
}

