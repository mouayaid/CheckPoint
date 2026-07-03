using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Room;
using PFE.Domain.Entities;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.RoomReservation;
using PFE.Domain.Enums;
using PFE.Application.Common.Exceptions;
using QRCoder;

namespace PFE.Application.Services;

public class RoomService : IRoomService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IRoomReservationService _roomReservationService;

    public RoomService(
        IApplicationDbContext context,
        IMapper mapper,
        IRoomReservationService roomReservationService)
    {
        _context = context;
        _mapper = mapper;
        _roomReservationService = roomReservationService;
    }

    // ===== Methods required by IRoomService =====

    public async Task<List<RoomDto>> GetAllAsync()
    {
        var rooms = await _context.Rooms
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .ToListAsync();
        return _mapper.Map<List<RoomDto>>(rooms);
    }

    public async Task<List<RoomDto>> GetAllForManagementAsync()
    {
        var rooms = await _context.Rooms
            .OrderByDescending(r => r.IsActive)
            .ThenBy(r => r.Name)
            .ToListAsync();

        return _mapper.Map<List<RoomDto>>(rooms);
    }

    public async Task<RoomDto?> GetByIdAsync(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return null;
        return _mapper.Map<RoomDto>(room);
    }

    public async Task<RoomDto> CreateAsync(CreateRoomDto dto)
    {
        var normalizedName = dto.Name.Trim().ToLower();
        var nameExists = await _context.Rooms
            .AnyAsync(r => r.Name.ToLower() == normalizedName);

        if (nameExists)
            throw new ConflictException("Une salle portant ce nom existe déjà.");

        dto.Name = dto.Name.Trim();
        var room = _mapper.Map<Room>(dto);
        room.IsActive = true;

        _context.Rooms.Add(room);
        await _context.SaveChangesAsync();

        return _mapper.Map<RoomDto>(room);
    }

    public async Task<RoomDto?> UpdateAsync(int id, UpdateRoomDto dto)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return null;

        var normalizedName = dto.Name.Trim().ToLower();
        var nameExists = await _context.Rooms
            .AnyAsync(r => r.Id != id && r.Name.ToLower() == normalizedName);

        if (nameExists)
            throw new ConflictException("Une salle portant ce nom existe déjà.");

        dto.Name = dto.Name.Trim();
        _mapper.Map(dto, room);
        _context.Rooms.Update(room);
        await _context.SaveChangesAsync();

        return _mapper.Map<RoomDto>(room);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return false;

        var hasReservations = await _context.RoomReservations
            .AnyAsync(r => r.RoomId == id);

        if (hasReservations)
        {
            throw new ConflictException(
                "Impossible de supprimer cette salle car elle contient des réservations. Désactivez-la plutôt.");
        }

        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<RoomDto> GeneratePermanentQrAsync(int roomId)
    {
        var room = await _context.Rooms.FindAsync(roomId);
        if (room == null)
            throw new NotFoundException($"Room {roomId} not found.");

        string qrContent = $"ROOM:{roomId}";

        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(qrContent, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrCodeData);

        byte[] qrCodeBytes = qrCode.GetGraphic(
            20,
            new byte[] { 0, 0, 0, 255 },
            new byte[] { 255, 255, 255, 255 },
            true
        );
        room.QrData = Convert.ToBase64String(qrCodeBytes);

        _context.Rooms.Update(room);
        await _context.SaveChangesAsync();

        return _mapper.Map<RoomDto>(room);
    }

    // ===== Extra room reservation methods you already use elsewhere =====

    public async Task<List<RoomReservationDto>> GetAvailableTimeSlotsAsync(int roomId, DateTime date)
    {
        await _roomReservationService.CleanupExpiredUnstartedReservationsAsync();

        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var roomExists = await _context.Rooms
            .AnyAsync(r => r.Id == roomId && r.IsActive);

        if (!roomExists)
            throw new NotFoundException($"Room with id {roomId} not found.");

        var reservations = await _context.RoomReservations
            .Include(r => r.User)
            .Include(r => r.Room)
            .Where(r => r.RoomId == roomId &&
                        (((r.Status == ReservationStatus.Pending ||
                           r.Status == ReservationStatus.Active) &&
                          r.StartDateTime < endOfDay &&
                          r.EndDateTime > startOfDay) ||
                         (r.Status == ReservationStatus.InProgress &&
                          (r.StartedAt ?? r.StartDateTime) < endOfDay)))
            .ToListAsync();

        return _mapper.Map<List<RoomReservationDto>>(reservations);
    }

    public async Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto)
    {
        await _roomReservationService.CleanupExpiredUnstartedReservationsAsync();

        var room = await _context.Rooms.FindAsync(dto.RoomId);
        if (room == null || !room.IsActive)
        {
            return null;
        }

        var overlapping = await _context.RoomReservations
            .AnyAsync(r => r.RoomId == dto.RoomId &&
                          (((r.Status == ReservationStatus.Pending ||
                             r.Status == ReservationStatus.Active) &&
                            r.StartDateTime < dto.EndDateTime &&
                            r.EndDateTime > dto.StartDateTime) ||
                           (r.Status == ReservationStatus.InProgress &&
                            (r.StartedAt ?? r.StartDateTime) < dto.EndDateTime)));

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
        await _roomReservationService.CleanupExpiredUnstartedReservationsAsync();

        var reservations = await _context.RoomReservations
            .Include(r => r.User)
            .Include(r => r.Room)
            .Where(r => r.UserId == userId &&
                        (r.Status == ReservationStatus.Pending ||
                         r.Status == ReservationStatus.Active ||
                         r.Status == ReservationStatus.InProgress ||
                         r.Status == ReservationStatus.Completed))
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
}
