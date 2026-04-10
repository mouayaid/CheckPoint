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
            .Where(u =>
                (u.Role == Role.Manager || u.Role == Role.Admin) &&
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
}