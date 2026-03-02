using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Desk;
using PFE.Domain.Entities;

namespace PFE.Application.Services;

public class DeskService : IDeskService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public DeskService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<List<DeskDto>> GetAllDesksAsync()
    {
        var desks = await _context.Desks.ToListAsync();
        return _mapper.Map<List<DeskDto>>(desks);
    }

    public async Task<DeskReservationDto?> CreateReservationAsync(int userId, CreateDeskReservationDto dto)
    {
        var desk = await _context.Desks.FindAsync(dto.DeskId);
        if (desk == null || !desk.IsAvailable)
            return null;

        var alreadyReserved = await _context.DeskReservations.AnyAsync(r =>
            r.DeskId == dto.DeskId &&
            r.ReservationDate.Date == dto.ReservationDate.Date &&
            r.Status == "Active");

        if (alreadyReserved)
            return null;

        var reservation = new DeskReservation
        {
            UserId = userId,
            DeskId = dto.DeskId,
            ReservationDate = dto.ReservationDate,
            Status = "Active",
            CreatedAt = DateTime.UtcNow
        };

        _context.DeskReservations.Add(reservation);
        await _context.SaveChangesAsync();

        var created = await _context.DeskReservations
            .Include(r => r.User)
            .Include(r => r.Desk)
            .FirstOrDefaultAsync(r => r.Id == reservation.Id);

        return created == null ? null : _mapper.Map<DeskReservationDto>(created);
    }

    public async Task<List<DeskReservationDto>> GetUserReservationsAsync(int userId)
    {
        var reservations = await _context.DeskReservations
            .Include(r => r.User)
            .Include(r => r.Desk)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.ReservationDate)
            .ToListAsync();

        return _mapper.Map<List<DeskReservationDto>>(reservations);
    }

    public async Task<bool> CancelReservationAsync(int reservationId, int userId)
    {
        var reservation = await _context.DeskReservations
            .FirstOrDefaultAsync(r => r.Id == reservationId && r.UserId == userId);

        if (reservation == null || reservation.Status != "Active")
            return false;

        reservation.Status = "Cancelled";
        await _context.SaveChangesAsync();
        return true;
    }
}
