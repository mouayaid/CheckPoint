using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Room;
using PFE.Domain.Entities;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.RoomReservation;
using PFE.Domain.Enums;
using PFE.Application.Common.Exceptions;

namespace PFE.Application.Services;

public class RoomService : IRoomService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public RoomService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<List<RoomDto>> GetAllRoomsAsync()
    {
        var rooms = await _context.Rooms
            .Where(r => r.IsActive)
            .ToListAsync();
        return _mapper.Map<List<RoomDto>>(rooms);
    }

    public async Task<List<RoomReservationDto>> GetAvailableTimeSlotsAsync(int roomId, DateTime date)
    {
        // ✅ Check if room exists and is active
        var roomExists = await _context.Rooms
            .AnyAsync(r => r.Id == roomId && r.IsActive);

        if (!roomExists)
            throw new NotFoundException($"Room with id {roomId} not found.");

        var reservations = await _context.RoomReservations
            .Include(r => r.User)
            .Include(r => r.Room)
            .Where(r => r.RoomId == roomId &&
                        r.StartDateTime.Date == date.Date &&
                        r.Status == ReservationStatus.Active)
            .ToListAsync();

        return _mapper.Map<List<RoomReservationDto>>(reservations);
    }


    public async Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto)
    {
        // Check if room exists and is active
        var room = await _context.Rooms.FindAsync(dto.RoomId);
        if (room == null || !room.IsActive)
        {
            return null;
        }

        // Check for overlapping reservations
        var overlapping = await _context.RoomReservations
            .AnyAsync(r => r.RoomId == dto.RoomId &&
                          r.Status == ReservationStatus.Active &&
                          ((r.StartDateTime < dto.EndDateTime && r.EndDateTime > dto.StartDateTime)));

        if (overlapping)
        {
            return null;
        }

        var reservation = new RoomReservation
        {
            UserId = userId,
            RoomId = dto.RoomId,
            StartDateTime = dto.StartDateTime,
            EndDateTime = dto.EndDateTime,
            Purpose = dto.Purpose,
            Status = ReservationStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.RoomReservations.Add(reservation);
        await _context.SaveChangesAsync();

        var reservationDto = await _context.RoomReservations
            .Include(r => r.User)
            .Include(r => r.Room)
            .FirstOrDefaultAsync(r => r.Id == reservation.Id);

        return _mapper.Map<RoomReservationDto>(reservationDto);
    }

    public async Task<List<RoomReservationDto>> GetUserReservationsAsync(int userId)
    {
        var reservations = await _context.RoomReservations
            .Include(r => r.User)
            .Include(r => r.Room)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<RoomReservationDto>>(reservations);
    }

    public async Task CancelReservationAsync(int reservationId, int userId)
    {
        var reservation = await _context.RoomReservations
            .FirstOrDefaultAsync(r => r.Id == reservationId && r.UserId == userId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        if (reservation.Status != ReservationStatus.Pending &&
            reservation.Status != ReservationStatus.Active)
            throw new ConflictException("Only pending or active reservations can be cancelled.");

        reservation.Status = ReservationStatus.Cancelled;

        await _context.SaveChangesAsync();
    }

    public async Task<RoomDto?> GetRoomByIdAsync(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return null;
        return _mapper.Map<RoomDto>(room);
    }

    public async Task<RoomDto> CreateRoomAsync(CreateRoomDto dto)
    {
        var room = _mapper.Map<Room>(dto);
        room.IsActive = true;
        _context.Rooms.Add(room);
        await _context.SaveChangesAsync();
        return _mapper.Map<RoomDto>(room);
    }

    public async Task<RoomDto?> UpdateRoomAsync(int id, UpdateRoomDto dto)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return null;

        _mapper.Map(dto, room);
        _context.Rooms.Update(room);
        await _context.SaveChangesAsync();

        return _mapper.Map<RoomDto>(room);
    }

    public async Task<bool> DeleteRoomAsync(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return false;

        room.IsActive = false; // Soft delete
        _context.Rooms.Update(room);
        await _context.SaveChangesAsync();

        return true;
    }
}

