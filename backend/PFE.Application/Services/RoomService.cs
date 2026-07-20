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
    private readonly IAppTimeProvider _timeProvider;

    public RoomService(
        IApplicationDbContext context,
        IMapper mapper,
        IAppTimeProvider timeProvider)
    {
        _context = context;
        _mapper = mapper;
        _timeProvider = timeProvider;
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

    public async Task<List<RoomReservationDto>> GetUserReservationsAsync(int userId)
    {
        await ExpireOverdueActiveUserReservationsAsync(userId);

        var reservations = await _context.RoomReservations
            .Include(r => r.User)
            .Include(r => r.Room)
            .Where(r => r.UserId == userId &&
                        (r.Status == ReservationStatus.Active ||
                         r.Status == ReservationStatus.InProgress ||
                         r.Status == ReservationStatus.Completed ||
                         r.Status == ReservationStatus.Expired ||
                         r.Status == ReservationStatus.Cancelled))
            .OrderByDescending(r => r.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<RoomReservationDto>>(reservations);
    }

    public async Task CancelReservationAsync(int reservationId, int userId)
    {
        var actorRole = await GetActorRoleAsync(userId);
        if (actorRole != "Manager")
            throw new ForbiddenException("Only managers can cancel room reservations.");

        var reservation = await _context.RoomReservations
            .FirstOrDefaultAsync(r => r.Id == reservationId && r.UserId == userId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        if (RoomReservationLifecycle.ExpireIfOverdue(reservation, _timeProvider.UtcNow))
        {
            await _context.SaveChangesAsync();
            throw new ConflictException("Expired reservations cannot be cancelled.");
        }

        if (reservation.Status != ReservationStatus.Active)
            throw new ConflictException("Only an active reservation can be cancelled.");

        reservation.Status = ReservationStatus.Cancelled;

        await _context.SaveChangesAsync();
    }

    private async Task<string> GetActorRoleAsync(int userId)
    {
        var actor = await _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (actor == null)
            throw new NotFoundException("User not found.");

        return actor.Role.Name;
    }

    private async Task ExpireOverdueActiveUserReservationsAsync(int userId)
    {
        var now = _timeProvider.UtcNow;
        var expirationCutoff = now.Subtract(RoomReservationLifecycle.StartGracePeriod);
        var reservations = await _context.RoomReservations
            .Where(r => r.UserId == userId &&
                        r.Status == ReservationStatus.Active &&
                        r.StartedAt == null &&
                        r.StartDateTime < expirationCutoff)
            .ToListAsync();

        var changed = false;
        foreach (var reservation in reservations)
        {
            changed |= RoomReservationLifecycle.ExpireIfOverdue(reservation, now);
        }

        if (changed)
        {
            await _context.SaveChangesAsync();
        }
    }
}
