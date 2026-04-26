using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Seat;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;
using PFE.Domain.Entities;
using PFE.Application.DTOs.Layout;

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
            .Where(r => r.Date.Date == dateOnly && r.Status == SeatReservationStatus.Active)
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

    public async Task<List<SeatDto>> GetAllSeatsAsync()
    {
        var seats = await _context.Seats
            .Include(s => s.OfficeTable)
            .ToListAsync();
        return _mapper.Map<List<SeatDto>>(seats);
    }

    public async Task<List<SeatDto>> GetSeatsByTableAsync(int officeTableId)
    {
        var seats = await _context.Seats
            .Include(s => s.OfficeTable)
            .Where(s => s.OfficeTableId == officeTableId)
            .OrderBy(s => s.Label)
            .ToListAsync();
        return _mapper.Map<List<SeatDto>>(seats);
    }

    public async Task<SeatDto?> GetSeatByIdAsync(int id)
    {
        var seat = await _context.Seats
            .Include(s => s.OfficeTable)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (seat == null) return null;
        return _mapper.Map<SeatDto>(seat);
    }

    public async Task<SeatDto> CreateSeatAsync(CreateSeatDto dto)
    {
        var seat = _mapper.Map<Seat>(dto);
        seat.IsActive = true;
        _context.Seats.Add(seat);
        await _context.SaveChangesAsync();

        // Reload to get OfficeTable for DTO mapping
        var createdSeat = await _context.Seats
            .Include(s => s.OfficeTable)
            .FirstAsync(s => s.Id == seat.Id);

        return _mapper.Map<SeatDto>(createdSeat);
    }

    public async Task<SeatDto?> UpdateSeatAsync(int id, UpdateSeatDto dto)
    {
        var seat = await _context.Seats.FindAsync(id);
        if (seat == null) return null;

        _mapper.Map(dto, seat);
        _context.Seats.Update(seat);
        await _context.SaveChangesAsync();

        var updatedSeat = await _context.Seats
            .Include(s => s.OfficeTable)
            .FirstAsync(s => s.Id == seat.Id);

        return _mapper.Map<SeatDto>(updatedSeat);
    }

    public async Task<bool> DeleteSeatAsync(int id)
    {
        var seat = await _context.Seats.FindAsync(id);
        if (seat == null) return false;

        seat.IsActive = false; // Soft delete
        _context.Seats.Update(seat);
        await _context.SaveChangesAsync();

        return true;
    }
    public async Task<SeatDto?> UpdateSeatPositionAsync(int id, UpdatePositionDto dto)
    {
        var seat = await _context.Seats.FindAsync(id);

        if (seat == null)
            return null;

        seat.PositionX = dto.PositionX;
        seat.PositionY = dto.PositionY;

        await _context.SaveChangesAsync();

        return new SeatDto
        {
            Id = seat.Id,
            Label = seat.Label,
            OfficeTableId = seat.OfficeTableId,
            PositionX = seat.PositionX,
            PositionY = seat.PositionY,
            IsActive = seat.IsActive
        };
    }
}

