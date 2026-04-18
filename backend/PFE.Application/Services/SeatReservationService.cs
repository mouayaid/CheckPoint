using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.SeatReservation;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class SeatReservationService : ISeatReservationService
{

    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public async Task<bool> CancelMyTodayReservationAsync(int userId)
    {
        var today = GetTunisiaNow().Date;

        var reservation = await _context.SeatReservations
            .FirstOrDefaultAsync(r =>
                r.UserId == userId &&
                r.Date.Date == today &&
                r.Status == SeatReservationStatus.Active);

        if (reservation == null)
            return false;

        reservation.Status = SeatReservationStatus.Cancelled;

        await _context.SaveChangesAsync();
        return true;
    }
    public SeatReservationService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<SeatReservationDto?> CreateReservationAsync(int userId, SeatReservationCreateDto dto)
    {
        var dateOnly = dto.Date.Date;

        // ✅ Tunisia "today" validation (Africa/Tunis)
        var tunisToday = GetTunisiaNow().Date;

        // Allow ONLY today's date (Tunisia)
        if (dateOnly != tunisToday)
        {
            throw new FrontendValidationException(
                400,
                $"Desk reservation is allowed for today only (Tunisia): {tunisToday:yyyy-MM-dd}.",
                new[] { "NOT_TODAY" }
            );
        }

        // Validation 1: Check if seat exists and is active
        var seat = await _context.Seats
            .Include(s => s.OfficeTable)
            .FirstOrDefaultAsync(s => s.Id == dto.SeatId && s.IsActive);

        if (seat == null)
        {
            throw new FrontendValidationException(
                422,
                "Selected seat is inactive or does not exist.",
                new[] { "SEAT_INACTIVE" }
            );
        }

        // Validation 2: Prevent double booking - seat already reserved for this date
        var existingSeatReservation = await _context.SeatReservations
            .AnyAsync(r => r.SeatId == dto.SeatId &&
                           r.Date.Date == dateOnly &&
                           r.Status == SeatReservationStatus.Active);

        if (existingSeatReservation)
        {
            throw new FrontendValidationException(
                409,
                "Selected seat is already reserved for today.",
                new[] { "SEAT_TAKEN" }
            );
        }

        // Validation 3: Prevent user booking 2 seats on the same date
        var existingUserReservation = await _context.SeatReservations
            .AnyAsync(r => r.UserId == userId &&
                           r.Date.Date == dateOnly &&
                           r.Status == SeatReservationStatus.Active);

        if (existingUserReservation)
        {
            throw new FrontendValidationException(
                409,
                "You already have a seat reservation for today.",
                new[] { "USER_ALREADY_HAS_SEAT" }
            );
        }

        // Create reservation
        var reservation = new SeatReservation
        {
            SeatId = dto.SeatId,
            UserId = userId,
            Date = dateOnly,
            Status = SeatReservationStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.SeatReservations.Add(reservation);
        await _context.SaveChangesAsync();

        // Reload with includes for mapping
        var savedReservation = await _context.SeatReservations
            .Include(r => r.Seat)
                .ThenInclude(s => s.OfficeTable)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservation.Id);



        return _mapper.Map<SeatReservationDto>(savedReservation);
    }



    public async Task<SeatReservationDto?> GetMyTodayReservationAsync(int userId)
    {
        var tunisToday = GetTunisiaNow().Date;

        var reservation = await _context.SeatReservations
            .AsNoTracking()
            .Include(r => r.Seat)
                .ThenInclude(s => s.OfficeTable)
            .Include(r => r.User)
            .Where(r => r.UserId == userId
                        && r.Date.Date == tunisToday
                        && r.Status == SeatReservationStatus.Active)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        return reservation == null ? null : _mapper.Map<SeatReservationDto>(reservation);
    }

    public async Task<bool> CancelReservationAsync(int reservationId, int userId, string userRole)
    {
        var reservation = await _context.SeatReservations
            .Include(r => r.Seat)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
        {
            return false; // Reservation not found
        }

        // Authorization: Only owner or Admin can cancel
        if (reservation.UserId != userId && userRole != "Admin")
        {
            return false; // Unauthorized
        }

        // Only allow cancellation of active reservations
        if (reservation.Status != SeatReservationStatus.Active)
        {
            return false; // Reservation is not active
        }

        // Update status to Cancelled
        reservation.Status = SeatReservationStatus.Cancelled;
        await _context.SaveChangesAsync();

        // Create notification for the user
        await _notificationService.CreateNotificationAsync(
            reservation.UserId,
            "Seat Reservation Cancelled",
            $"Your seat reservation for {reservation.Seat.Label} on {reservation.Date:yyyy-MM-dd} has been cancelled.",
            "Info",
            "SeatReservation",
            reservation.Id);

        return true;
    }

    // ✅ Cross-platform Tunisia time helper
    private static DateTime GetTunisiaNow()
    {
        // Linux/macOS typically support "Africa/Tunis"
        // Windows may require a Windows timezone ID.
        // We'll try a few known IDs safely.

        TimeZoneInfo tz;

        // Try IANA first
        if (TryFindTimeZone("Africa/Tunis", out tz))
        {
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }

        // Windows fallback candidates (depends on the OS install)
        // If none exist, fall back to server local time.
        var windowsCandidates = new[]
        {
            "Tunisia Standard Time",
            "W. Central Africa Standard Time"
        };

        foreach (var id in windowsCandidates)
        {
            if (TryFindTimeZone(id, out tz))
            {
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
        }

        // Last resort fallback
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

    public async Task<SeatReservationDto> CheckInAsync(int userId, SeatCheckInDto dto)
    {
        var today = GetTunisiaNow().Date;

        var seat = await _context.Seats
            .FirstOrDefaultAsync(s => s.QrCodeValue == dto.QrCodeValue && s.IsActive);

        if (seat == null)
            throw new FrontendValidationException(
                422,
                "Invalid seat QR code.",
                new[] { "INVALID_QR" }
            );

        var reservation = await _context.SeatReservations
            .Include(r => r.Seat)
            .FirstOrDefaultAsync(r =>
                r.UserId == userId &&
                r.SeatId == seat.Id &&
                r.Date.Date == today &&
                r.Status == SeatReservationStatus.Active);

        if (reservation == null)
            throw new FrontendValidationException(
                404,
                "No active reservation for this seat today.",
                new[] { "NO_RESERVATION" }
            );

        if (reservation.Status == SeatReservationStatus.CheckedIn)
            throw new FrontendValidationException(
                400,
                "Already checked in.",
                new[] { "ALREADY_CHECKED_IN" }
            );
        reservation.Status = SeatReservationStatus.CheckedIn;
        reservation.CheckedInAt = GetTunisiaNow();

        await _context.SaveChangesAsync();

        return _mapper.Map<SeatReservationDto>(reservation);
    }

    public async Task<List<MonthCheckInDto>> GetMyMonthReservationsAsync(int userId, int year, int month)
    {
        var startDate = new DateTime(year, month, 1);
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var endDate = startDate.AddDays(daysInMonth - 1).Date.AddDays(1).AddTicks(-1); // end of month

        var reservations = await _context.SeatReservations
            .AsNoTracking()
            .Where(r => r.UserId == userId && 
                       r.Date >= startDate.Date && 
                       r.Date <= endDate.Date &&
                       r.Status != SeatReservationStatus.Cancelled)
            .Select(r => new MonthCheckInDto
            {
                Date = r.Date,
                Status = r.Status,
                CheckedInAt = r.CheckedInAt
            })
            .ToListAsync();

        return reservations;
    }
}

