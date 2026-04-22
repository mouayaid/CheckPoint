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

    public async Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto)
    {
        var start = dto.StartDateTime;
        var end = dto.EndDateTime;

        var room = await _context.Rooms.FindAsync(dto.RoomId);
        if (room == null || !room.IsActive)
            throw new NotFoundException($"Room with id {dto.RoomId} not found or inactive.");

        if (end <= start)
            throw new BadRequestException("End time must be after start time.");

        if (start.Date != end.Date)
            throw new BadRequestException("Room reservation must start and end on the same day.");

        if (start < DateTime.Now)
            throw new BadRequestException("You cannot create a reservation in the past.");

        var overlapping = await _context.RoomReservations
            .AnyAsync(r =>
                r.RoomId == dto.RoomId &&
                r.Status == ReservationStatus.Active &&
                r.StartDateTime < end &&
                r.EndDateTime > start);

        if (overlapping)
            throw new ConflictException("This time slot overlaps with an existing reservation.");

        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException($"User with id {userId} not found.");

        var reservation = new RoomReservation
        {
            RoomId = dto.RoomId,
            UserId = userId,
            StartDateTime = start,
            EndDateTime = end,
            Status = ReservationStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.RoomReservations.Add(reservation);
        await _context.SaveChangesAsync();

        var savedReservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservation.Id);

        return _mapper.Map<RoomReservationDto>(savedReservation);
    }

    public async Task StartMeetingViaQrAsync(int resId, int scannedRoomId, int userId)
    {
        var reservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == resId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        if (reservation.UserId != userId)
            throw new UnauthorizedAccessException("Not your reservation.");

        if (reservation.Status != ReservationStatus.Active)
            throw new ConflictException("Reservation not active.");

        if (reservation.RoomId != scannedRoomId)
            throw new BadRequestException("Scanned room does not match reservation room.");

        if (reservation.StartDateTime < DateTime.UtcNow)
            throw new BadRequestException("Reservation has expired.");

        if (reservation.StartedAt.HasValue)
            throw new ConflictException("Meeting already started.");

        reservation.StartedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task FinishMeetingViaQrAsync(int resId, int scannedRoomId, int userId)
    {
        var reservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == resId);

        if (reservation == null)
            throw new NotFoundException("Reservation not found.");

        if (reservation.UserId != userId)
            throw new UnauthorizedAccessException("Not your reservation.");

        if (reservation.Status != ReservationStatus.Active)
            throw new ConflictException("Reservation not active.");

        if (reservation.RoomId != scannedRoomId)
            throw new BadRequestException("Scanned room does not match reservation room.");

        if (!reservation.StartedAt.HasValue)
            throw new ConflictException("Meeting not started.");

        reservation.Status = ReservationStatus.Completed;
        reservation.EndedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
