using PFE.Application.DTOs.Seat;

namespace PFE.Application.Services;

public interface ISeatService
{
    Task<List<SeatMapResponseDto>> GetSeatMapAsync(DateTime date);
}

