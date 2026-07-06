using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.RoomReservation;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class RoomReservationService : IRoomReservationService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public RoomReservationService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task CleanupExpiredUnstartedReservationsAsync()
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-15);

        var expiredReservations = await _context.RoomReservations
            .Where(r =>
                (r.Status == ReservationStatus.Pending ||
                 r.Status == ReservationStatus.Active) &&
                r.StartedAt == null &&
                r.EndDateTime < cutoff)
            .ToListAsync();

        if (expiredReservations.Count > 0)
        {
            _context.RoomReservations.RemoveRange(expiredReservations);
            await _context.SaveChangesAsync();
        }

        Console.WriteLine(
            $"Room cleanup: removed {expiredReservations.Count} expired unstarted reservations."
        );
    }

    public async Task<List<RoomReservationForDayDto>> GetReservationsForDayAsync(int roomId, DateTime date)
    {
        await CleanupExpiredUnstartedReservationsAsync();

        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var reservations = await _context.RoomReservations
            .AsNoTracking()
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.Room)
            .Where(r => r.RoomId == roomId &&
                        (((r.Status == ReservationStatus.Pending ||
                           r.Status == ReservationStatus.Active) &&
                          r.StartDateTime < endOfDay &&
                          r.EndDateTime > startOfDay) ||
                         (r.Status == ReservationStatus.InProgress &&
                          (r.StartedAt ?? r.StartDateTime) < endOfDay)))
            .OrderBy(r => r.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<RoomReservationForDayDto>>(reservations);
    }

    public async Task<RoomReservationDto> CreateReservationAsync(int creatorId, CreateRoomReservationDto dto)
    {
        await CleanupExpiredUnstartedReservationsAsync();

        var roomExists = await _context.Rooms
            .AnyAsync(r => r.Id == dto.RoomId && r.IsActive);

        if (!roomExists)
            throw new NotFoundException($"Room with id {dto.RoomId} not found.");

        var hasConflict = await _context.RoomReservations
            .AnyAsync(r =>
                r.RoomId == dto.RoomId &&
                (((r.Status == ReservationStatus.Pending ||
                   r.Status == ReservationStatus.Active) &&
                  r.StartDateTime < dto.EndDateTime &&
                  r.EndDateTime > dto.StartDateTime) ||
                 (r.Status == ReservationStatus.InProgress &&
                  (r.StartedAt ?? r.StartDateTime) < dto.EndDateTime)));

        if (hasConflict)
            throw new ConflictException("This room is already reserved for the selected time slot.");

        var reservation = new RoomReservation
        {
            RoomId = dto.RoomId,
            StartDateTime = dto.StartDateTime,
            EndDateTime = dto.EndDateTime,
            Purpose = dto.Purpose,
            // Active is the current confirmed/usable room reservation state.
            Status = ReservationStatus.Active,
            UserId = creatorId,
            CreatedById = creatorId,
            CreatedAt = DateTime.UtcNow
        };

        _context.RoomReservations.Add(reservation);
        await _context.SaveChangesAsync();

        var createdReservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .FirstAsync(r => r.Id == reservation.Id);

        return _mapper.Map<RoomReservationDto>(createdReservation);
    }

    public async Task FinishMeetingViaQrAsync(int resId, int scannedRoomId, int userId)
    {
        var reservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == resId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        var actorRole = await GetActorRoleAsync(userId);
        EnsureCanFinish(reservation, userId, actorRole);

        if (reservation.Status != ReservationStatus.InProgress)
            throw new BadRequestException("Only an in-progress reservation can be finished.");

        if (reservation.RoomId != scannedRoomId)
            throw new BadRequestException("Scanned room does not match reservation room.");

        if (!reservation.StartedAt.HasValue)
            throw new BadRequestException("Meeting not started.");

        reservation.Status = ReservationStatus.Completed;
        reservation.EndedAt = DateTime.UtcNow;
        reservation.EndedById = userId;

        await _context.SaveChangesAsync();
    }

    public async Task FinishMeetingAsync(int reservationId, int userId)
    {
        if (userId <= 0)
            throw new BadRequestException("Invalid user.");

        var reservation = await _context.RoomReservations
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        var actorRole = await GetActorRoleAsync(userId);
        EnsureCanFinish(reservation, userId, actorRole);

        if (reservation.Status != ReservationStatus.InProgress)
            throw new BadRequestException("Only an in-progress reservation can be finished.");

        reservation.Status = ReservationStatus.Completed;
        reservation.EndedAt = DateTime.UtcNow;
        reservation.EndedById = userId;

        await _context.SaveChangesAsync();
    }

    public async Task StartMeetingViaQrAsync(int reservationId, int scannedRoomId, int scannerUserId)
    {
        var reservation = await _context.RoomReservations.FindAsync(reservationId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        var actorRole = await GetActorRoleAsync(scannerUserId);

        if (actorRole != "Manager")
            throw new ForbiddenException("Only the manager who owns the reservation can start it.");

        if (!IsOwner(reservation, scannerUserId))
            throw new ForbiddenException("You cannot start another user's reservation.");

        if (reservation.RoomId != scannedRoomId)
            throw new BadRequestException("QR does not match this room.");

        if (reservation.Status != ReservationStatus.Active)
            throw new BadRequestException("Only an active reservation can be started.");

        if (reservation.StartedAt != null)
            throw new BadRequestException("Meeting already started.");

        reservation.StartedAt = DateTime.UtcNow;
        reservation.StartedById = scannerUserId;
        reservation.Status = ReservationStatus.InProgress;

        await _context.SaveChangesAsync();
    }

    public async Task CancelReservationAsync(int reservationId, int userId)
    {
        var reservation = await _context.RoomReservations
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        var actorRole = await GetActorRoleAsync(userId);

        if (actorRole != "Admin" && (actorRole != "Manager" || !IsOwner(reservation, userId)))
            throw new ForbiddenException("You cannot cancel another user's reservation.");

        if (reservation.Status is not ReservationStatus.Pending and not ReservationStatus.Active)
            throw new BadRequestException("Only pending or active reservations can be cancelled.");

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

    private static bool IsOwner(RoomReservation reservation, int userId)
    {
        return reservation.UserId == userId || reservation.CreatedById == userId;
    }

    private static void EnsureCanFinish(
        RoomReservation reservation,
        int userId,
        string actorRole)
    {
        if (actorRole == "Admin")
            return;

        if (actorRole != "Manager" || !IsOwner(reservation, userId))
            throw new ForbiddenException("You cannot finish another user's reservation.");
    }
}
