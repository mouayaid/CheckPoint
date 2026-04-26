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

    public async Task<List<RoomReservationForDayDto>> GetReservationsForDayAsync(int roomId, DateTime date)
    {
        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var reservations = await _context.RoomReservations
    .AsNoTracking()
    .Include(r => r.User)
        .ThenInclude(u => u.Department)
    .Include(r => r.Room)
    .Where(r => r.RoomId == roomId &&
                r.StartDateTime < endOfDay &&
                r.EndDateTime > startOfDay)
    .OrderBy(r => r.StartDateTime)
    .ToListAsync();

        return _mapper.Map<List<RoomReservationForDayDto>>(reservations);
    }

    public async Task<List<RoomReservationDto>> GetPendingReservationsAsync(int managerUserId)
    {
        var manager = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == managerUserId);

        if (manager == null)
            throw new NotFoundException($"User with id {managerUserId} not found.");

        var query = _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Where(r => r.Status == ReservationStatus.Pending);

        if (manager.Role == Role.Manager)
        {
            query = query.Where(r => r.User.DepartmentId == manager.DepartmentId);
        }

        var pending = await query
            .OrderBy(r => r.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<RoomReservationDto>>(pending);
    }

    public async Task<RoomReservationDto> CreateReservationAsync(int creatorId, CreateRoomReservationDto dto)
    {
        var reservation = new RoomReservation
        {
            RoomId = dto.RoomId,
            StartDateTime = dto.StartDateTime,
            EndDateTime = dto.EndDateTime,
            Purpose = dto.Purpose,
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

        if (reservation.Status != ReservationStatus.InProgress)
            throw new ConflictException("Reservation is not in progress.");

        if (reservation.RoomId != scannedRoomId)
            throw new BadRequestException("Scanned room does not match reservation room.");

        if (!reservation.StartedAt.HasValue)
            throw new ConflictException("Meeting not started.");

        reservation.Status = ReservationStatus.Completed;
        reservation.EndedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    public async Task StartMeetingViaQrAsync(int reservationId, int scannedRoomId, int scannerUserId)
    {
        var reservation = await _context.RoomReservations.FindAsync(reservationId);

        if (reservation == null)
            throw new Exception("Reservation not found.");

        if (reservation.RoomId != scannedRoomId)
            throw new Exception("QR does not match this room.");

        if (reservation.Status != ReservationStatus.Active)
            throw new Exception("Only active reservations can be started.");

        if (reservation.StartedAt != null)
            throw new Exception("Meeting already started.");

        reservation.StartedAt = DateTime.UtcNow;
        reservation.StartedById = scannerUserId;
        reservation.Status = ReservationStatus.InProgress;

        await _context.SaveChangesAsync();
    }
}
