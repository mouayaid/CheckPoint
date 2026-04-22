using PFE.Application.DTOs.Seat;

namespace PFE.Application.Services;

public interface ISeatService
{
    Task<List<SeatMapResponseDto>> GetSeatMapAsync(DateTime date);
    Task<List<SeatDto>> GetAllSeatsAsync();
    Task<List<SeatDto>> GetSeatsByTableAsync(int officeTableId);
    Task<SeatDto?> GetSeatByIdAsync(int id);
    Task<SeatDto> CreateSeatAsync(CreateSeatDto dto);
    Task<SeatDto?> UpdateSeatAsync(int id, UpdateSeatDto dto);
    Task<bool> DeleteSeatAsync(int id);
}

