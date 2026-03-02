using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Seat;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class SeatService : ISeatService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public SeatService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<List<SeatMapResponseDto>> GetSeatMapAsync(DateTime date)
    {
        // Load active seats with office table
        var seats = await _context.Seats
            .Include(s => s.OfficeTable)
            .Where(s => s.IsActive)
            .ToListAsync();

        // Load reservations for the specified date (Active status only) with User and Department
        var dateOnly = date.Date;
        var reservations = await _context.SeatReservations
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Where(r => r.Date.Date == dateOnly && r.Status == ReservationStatus.Active)
            .ToListAsync();

        // Create a dictionary for quick lookup: SeatId -> Reservation
        var reservationLookup = reservations.ToDictionary(r => r.SeatId);

        // Map seats to DTOs and join with reservations
        var seatMapDtos = seats.Select(seat =>
        {
            var dto = new SeatMapResponseDto
            {
                Id = seat.Id,
                Label = seat.Label,
                PositionX = seat.PositionX,
                PositionY = seat.PositionY,
                OfficeTableId = seat.OfficeTableId,
                IsReserved = reservationLookup.ContainsKey(seat.Id)
            };

            // If seat is reserved, populate ReservedBy info
            if (dto.IsReserved && reservationLookup.TryGetValue(seat.Id, out var reservation))
            {
                dto.ReservedBy = new ReservedByDto
                {
                    UserId = reservation.User.Id,
                    FullName = reservation.User.FullName,
                    DepartmentName = reservation.User.Department.Name
                };
            }

            return dto;
        }).ToList();

        return seatMapDtos;
    }
}

