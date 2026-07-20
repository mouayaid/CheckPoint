using AutoMapper;
using Microsoft.EntityFrameworkCore;
using System.Data;
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
    private readonly IAppTimeProvider _timeProvider;

    public RoomReservationService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService,
        IAppTimeProvider timeProvider)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
        _timeProvider = timeProvider;
    }

    public async Task<List<RoomReservationForDayDto>> GetReservationsForDayAsync(int roomId, DateTime date)
    {
        var tunisiaDate = DateOnly.FromDateTime(date);
        var startOfDay = _timeProvider.ConvertTunisiaToUtc(
            tunisiaDate.ToDateTime(TimeOnly.MinValue));
        var endOfDay = _timeProvider.ConvertTunisiaToUtc(
            tunisiaDate.AddDays(1).ToDateTime(TimeOnly.MinValue));

        await ExpireOverdueActiveReservationsAsync(
            r => r.RoomId == roomId &&
                 r.StartDateTime < endOfDay &&
                 r.EndDateTime > startOfDay);

        var reservations = await _context.RoomReservations
            .AsNoTracking()
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.Room)
            .Where(r => r.RoomId == roomId &&
                        ((r.Status == ReservationStatus.Active &&
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
        await using var transaction = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable);

        var actorRole = await GetActorRoleAsync(creatorId);
        if (actorRole != "Manager")
            throw new ForbiddenException("Only managers can create room reservations.");

        var roomExists = await _context.Rooms
            .AnyAsync(r => r.Id == dto.RoomId && r.IsActive);

        if (!roomExists)
            throw new NotFoundException($"Room with id {dto.RoomId} not found.");

        var startUtc = NormalizeReservationInputToUtc(dto.StartDateTime);
        var endUtc = NormalizeReservationInputToUtc(dto.EndDateTime);
        var startTunisia = _timeProvider.ConvertUtcToTunisia(startUtc);
        var endTunisia = _timeProvider.ConvertUtcToTunisia(endUtc);

        if (endUtc <= startUtc)
            throw new BadRequestException("Reservation end time must be after start time.");

        EnsureSameTunisiaDay(startTunisia, endTunisia);

        if (startUtc <= _timeProvider.UtcNow)
            throw new BadRequestException("Reservation start time must be in the future.");

        await ExpireOverdueActiveReservationsAsync(
            r => r.RoomId == dto.RoomId &&
                 r.StartDateTime < endUtc &&
                 r.EndDateTime > startUtc);

        var hasConflict = await _context.RoomReservations
            .AnyAsync(r =>
                r.RoomId == dto.RoomId &&
                ((r.Status == ReservationStatus.Active &&
                  r.StartDateTime < endUtc &&
                  r.EndDateTime > startUtc) ||
                 (r.Status == ReservationStatus.InProgress &&
                  (r.StartedAt ?? r.StartDateTime) < endUtc)));

        if (hasConflict)
            throw new ConflictException("This room is already reserved for the selected time slot.");

        var reservation = new RoomReservation
        {
            RoomId = dto.RoomId,
            StartDateTime = startUtc,
            EndDateTime = endUtc,
            Purpose = dto.Purpose,
            // Active is the current confirmed/usable room reservation state.
            Status = ReservationStatus.Active,
            UserId = creatorId,
            CreatedById = creatorId,
            CreatedAt = _timeProvider.UtcNow
        };

        _context.RoomReservations.Add(reservation);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        var createdReservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .FirstAsync(r => r.Id == reservation.Id);

        return _mapper.Map<RoomReservationDto>(createdReservation);
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
        reservation.EndedAt = _timeProvider.UtcNow;
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

        var now = _timeProvider.UtcNow;
        if (RoomReservationLifecycle.ExpireIfOverdue(reservation, now))
        {
            await _context.SaveChangesAsync();
            throw new BadRequestException("This reservation has expired because it was not started within 10 minutes of its scheduled start time.");
        }

        if (now < reservation.StartDateTime.Subtract(RoomReservationLifecycle.StartWindowLeadTime))
            throw new BadRequestException("This reservation can only be started up to 15 minutes before its scheduled start time.");

        if (now > RoomReservationLifecycle.StartDeadline(reservation))
            throw new BadRequestException("This reservation cannot be started because its scheduled time has passed.");

        reservation.StartedAt = now;
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

        if (actorRole != "Manager" || !IsOwner(reservation, userId))
            throw new ForbiddenException("You cannot cancel another user's reservation.");

        if (RoomReservationLifecycle.ExpireIfOverdue(reservation, _timeProvider.UtcNow))
        {
            await _context.SaveChangesAsync();
            throw new BadRequestException("Expired reservations cannot be cancelled.");
        }

        if (reservation.Status != ReservationStatus.Active)
            throw new BadRequestException("Only an active reservation can be cancelled.");

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

    private async Task ExpireOverdueActiveReservationsAsync(
        System.Linq.Expressions.Expression<Func<RoomReservation, bool>> predicate)
    {
        var now = _timeProvider.UtcNow;
        var expirationCutoff = now.Subtract(RoomReservationLifecycle.StartGracePeriod);
        var reservations = await _context.RoomReservations
            .Where(predicate)
            .Where(r => r.Status == ReservationStatus.Active &&
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

    private static bool IsOwner(RoomReservation reservation, int userId)
    {
        return reservation.UserId == userId || reservation.CreatedById == userId;
    }

    private static void EnsureCanFinish(
        RoomReservation reservation,
        int userId,
        string actorRole)
    {
        if (actorRole != "Manager" || !IsOwner(reservation, userId))
            throw new ForbiddenException("You cannot finish another user's reservation.");
    }

    private DateTime NormalizeReservationInputToUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc)
        {
            return value;
        }

        var tunisiaLocal = DateTime.SpecifyKind(value, DateTimeKind.Unspecified);
        return _timeProvider.ConvertTunisiaToUtc(tunisiaLocal);
    }

    private static void EnsureSameTunisiaDay(DateTime startTunisia, DateTime endTunisia)
    {
        if (startTunisia.Date != endTunisia.Date)
        {
            throw new BadRequestException("Reservation must start and end on the same Tunisia business day.");
        }
    }
}
