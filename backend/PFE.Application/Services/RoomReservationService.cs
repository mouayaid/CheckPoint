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
    var tunisToday = GetTunisiaNow().Date;

    if (date.Date != tunisToday)
        throw new BadRequestException(
            $"Reservations can only be viewed for today's date (Tunisia): {tunisToday:yyyy-MM-dd}.");

    var startOfDay = tunisToday;
    var endOfDay = tunisToday.AddDays(1);

    var reservations = await _context.RoomReservations
        .Include(r => r.User)
            .ThenInclude(u => u.Department)
        .Where(r => r.RoomId == roomId &&
                    r.Status == ReservationStatus.Active &&
                    r.StartDateTime >= startOfDay &&
                    r.StartDateTime < endOfDay)
        .OrderBy(r => r.StartDateTime)
        .ToListAsync();

    return reservations.Select(r => new RoomReservationForDayDto
    {
        Id = r.Id,
        StartDateTime = r.StartDateTime,
        EndDateTime = r.EndDateTime,
        ReservedBy = new ReservedByDto
        {
            UserId = r.User.Id,
            FullName = r.User.FullName,
            DepartmentName = r.User.Department.Name
        }
    }).ToList();
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
            query = query.Where(r => r.User.DepartmentId == manager.DepartmentId);

        var pending = await query
            .OrderBy(r => r.StartDateTime)
            .ToListAsync();

        return _mapper.Map<List<RoomReservationDto>>(pending);
    }

    public async Task ApproveReservationAsync(int reservationId, int managerUserId)
    {
        var manager = await _context.Users.FirstOrDefaultAsync(u => u.Id == managerUserId);
        if (manager == null)
            throw new NotFoundException($"User with id {managerUserId} not found.");

        if (manager.Role != Role.Manager && manager.Role != Role.Admin)
            throw new ForbiddenException("You are not allowed to approve reservations.");

        var reservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
            throw new NotFoundException($"Reservation with id {reservationId} not found.");

        if (reservation.Status != ReservationStatus.Pending)
            throw new ConflictException("Only pending reservations can be approved.");

        var overlapping = await _context.RoomReservations.AnyAsync(r =>
            r.RoomId == reservation.RoomId &&
            r.Status == ReservationStatus.Active &&
            r.StartDateTime < reservation.EndDateTime &&
            r.EndDateTime > reservation.StartDateTime);

        if (overlapping)
            throw new ConflictException("Cannot approve: time slot overlaps with an active reservation.");

        reservation.Status = ReservationStatus.Active;
        await _context.SaveChangesAsync();

        await _notificationService.CreateNotificationAsync(
            reservation.UserId,
            "Room Reservation Approved",
            $"Your reservation for {reservation.Room.Name} on {reservation.StartDateTime:yyyy-MM-dd HH:mm} has been approved.",
            "Success",
            "RoomReservation",
            reservation.Id
        );
    }

    public async Task RejectReservationAsync(int reservationId, int managerUserId, string? reason)
    {
        var manager = await _context.Users.FirstOrDefaultAsync(u => u.Id == managerUserId);
        if (manager == null)
            throw new NotFoundException($"User with id {managerUserId} not found.");

        if (manager.Role != Role.Manager && manager.Role != Role.Admin)
            throw new ForbiddenException("You are not allowed to reject reservations.");

        var reservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
            throw new NotFoundException($"Reservation with id {reservationId} not found.");

        if (reservation.Status != ReservationStatus.Pending)
            throw new ConflictException("Only pending reservations can be rejected.");

        reservation.Status = ReservationStatus.Rejected;
        await _context.SaveChangesAsync();

        var reasonText = string.IsNullOrWhiteSpace(reason) ? "" : $" Reason: {reason}";

        await _notificationService.CreateNotificationAsync(
            reservation.UserId,
            "Room Reservation Rejected",
            $"Your reservation for {reservation.Room.Name} was rejected.{reasonText}",
            "Warning",
            "RoomReservation",
            reservation.Id
        );
    }

    public async Task<RoomReservationDto?> CreateReservationAsync(int userId, CreateRoomReservationDto dto)
    {
        // ✅ Tunisia timezone "today"
        var tunisToday = GetTunisiaNow().Date;

        // NOTE: If your DTO is StartDateTime/EndDateTime, replace dto.StartTime/dto.EndTime accordingly.
        var start = dto.StartDateTime;
        var end = dto.EndDateTime;

        // ✅ Only today allowed (Tunisia) - both start & end must be on today's date in Tunisia
        if (start.Date != tunisToday || end.Date != tunisToday)
            throw new BadRequestException($"Room reservation is allowed only for today's date (Tunisia): {tunisToday:yyyy-MM-dd}.");

        // Validation 1: Check if room exists and is active
        var room = await _context.Rooms.FindAsync(dto.RoomId);
        if (room == null || !room.IsActive)
            throw new NotFoundException($"Room with id {dto.RoomId} not found or inactive.");

        // Validation 2: Ensure EndTime > StartTime
        if (end <= start)
            throw new ArgumentException("EndTime must be after StartTime.");

        // Validation 3: Check overlap with ACTIVE reservations
        var overlapping = await _context.RoomReservations
            .AnyAsync(r => r.RoomId == dto.RoomId &&
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
            Status = ReservationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.RoomReservations.Add(reservation);
        await _context.SaveChangesAsync();

        var savedReservation = await _context.RoomReservations
            .Include(r => r.Room)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservation.Id);

        if (savedReservation == null)
            throw new Exception("Reservation was created but could not be reloaded.");

        var managers = await _context.Users
            .Where(u => (u.Role == Role.Manager || u.Role == Role.Admin) &&
                        u.DepartmentId == user.DepartmentId)
            .ToListAsync();

        if (!managers.Any())
        {
            managers = await _context.Users
                .Where(u => u.Role == Role.Manager || u.Role == Role.Admin)
                .ToListAsync();
        }

        foreach (var manager in managers)
        {
            await _notificationService.CreateNotificationAsync(
                manager.Id,
                "New Room Reservation Request",
                $"{user.FullName} ({user.Department.Name}) has requested to reserve {room.Name} from {start:yyyy-MM-dd HH:mm} to {end:yyyy-MM-dd HH:mm}",
                "Info",
                "RoomReservation",
                reservation.Id
            );
        }

        return _mapper.Map<RoomReservationDto>(savedReservation);
    }

    // ✅ Cross-platform Tunisia time helper
    private static DateTime GetTunisiaNow()
    {
        TimeZoneInfo tz;

        if (TryFindTimeZone("Africa/Tunis", out tz))
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);

        var windowsCandidates = new[]
        {
            "Tunisia Standard Time",
            "W. Central Africa Standard Time"
        };

        foreach (var id in windowsCandidates)
        {
            if (TryFindTimeZone(id, out tz))
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }

        return DateTime.Now;
    }

    private static bool TryFindTimeZone(string id, out TimeZoneInfo tz)
    {
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch
        {
            tz = null!;
            return false;
        }
    }
}