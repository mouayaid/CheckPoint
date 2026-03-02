using AutoMapper;
using Microsoft.EntityFrameworkCore;
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
            return null; // Not allowed (past or future)
            // If you prefer a clear error message instead of null,
            // replace this with a custom exception (BadRequestException)
        }

        // Validation 1: Check if seat exists and is active
        var seat = await _context.Seats
            .Include(s => s.OfficeTable)
            .FirstOrDefaultAsync(s => s.Id == dto.SeatId && s.IsActive);

        if (seat == null)
        {
            return null; // Seat not found or inactive
        }

        // Validation 2: Prevent double booking - seat already reserved for this date
        var existingSeatReservation = await _context.SeatReservations
            .AnyAsync(r => r.SeatId == dto.SeatId &&
                           r.Date.Date == dateOnly &&
                           r.Status == ReservationStatus.Active);

        if (existingSeatReservation)
        {
            return null; // Seat already reserved for this date
        }

        // Validation 3: Prevent user booking 2 seats on the same date
        var existingUserReservation = await _context.SeatReservations
            .AnyAsync(r => r.UserId == userId &&
                           r.Date.Date == dateOnly &&
                           r.Status == ReservationStatus.Active);

        if (existingUserReservation)
        {
            return null; // User already has a seat reservation for this date
        }

        // Create reservation
        var reservation = new SeatReservation
        {
            SeatId = dto.SeatId,
            UserId = userId,
            Date = dateOnly,
            Status = ReservationStatus.Active,
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

        // Create notification for the user
        await _notificationService.CreateNotificationAsync(
            userId,
            "Seat Reservation Confirmed",
            $"Your seat reservation for {seat.Label} on {dateOnly:yyyy-MM-dd} has been confirmed.",
            "Success",
            "SeatReservation",
            reservation.Id);

        return _mapper.Map<SeatReservationDto>(savedReservation);
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
        if (reservation.Status != ReservationStatus.Active)
        {
            return false; // Reservation is not active
        }

        // Update status to Cancelled
        reservation.Status = ReservationStatus.Cancelled;
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
}