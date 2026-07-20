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
    private readonly IAppTimeProvider _timeProvider;

    private static readonly SeatReservationStatus[] BlockingStatuses =
    [
        SeatReservationStatus.Active,
        SeatReservationStatus.CheckedIn
    ];

    private static readonly TimeOnly EndOfDeskDay = new(17, 0);

    public static bool IsBlockingStatus(SeatReservationStatus status) =>
        BlockingStatuses.Contains(status);

    public async Task<bool> CancelMyTodayReservationAsync(int userId)
    {
        await NormalizeDueReservationsAsync();
        var today = GetTunisiaToday();

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
        INotificationService notificationService,
        IAppTimeProvider timeProvider)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
        _timeProvider = timeProvider;
    }

    public async Task<SeatReservationDto?> CreateReservationAsync(int userId, SeatReservationCreateDto dto)
    {
        await NormalizeDueReservationsAsync();
        var dateOnly = dto.Date.Date;

        var tunisToday = GetTunisiaToday();

        // Allow ONLY today's date (Tunisia)
        if (dateOnly != tunisToday)
        {
            throw new FrontendValidationException(
                400,
                $"Desk reservation is allowed for today only (Tunisia): {tunisToday:yyyy-MM-dd}.",
                new[] { "NOT_TODAY" }
            );
        }

        if (_timeProvider.TunisiaCurrentTime >= EndOfDeskDay)
        {
            throw new FrontendValidationException(
                400,
                "Desk reservation is closed after 17:00 Tunisia time.",
                new[] { "DESK_DAY_ENDED" }
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
                           BlockingStatuses.Contains(r.Status));

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
                           BlockingStatuses.Contains(r.Status));

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
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            throw new FrontendValidationException(
                409,
                "Selected seat is already reserved or you already have a seat reservation for today.",
                new[] { "SEAT_RESERVATION_CONFLICT" }
            );
        }

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
        await NormalizeDueReservationsAsync();
        var tunisToday = GetTunisiaToday();

        var reservation = await _context.SeatReservations
            .AsNoTracking()
            .Include(r => r.Seat)
                .ThenInclude(s => s.OfficeTable)
            .Include(r => r.User)
            .Where(r => r.UserId == userId
                        && r.Date.Date == tunisToday
                        && (r.Status == SeatReservationStatus.Active
                            || r.Status == SeatReservationStatus.CheckedIn
                            || r.Status == SeatReservationStatus.Completed))
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        return reservation == null ? null : _mapper.Map<SeatReservationDto>(reservation);
    }

    public async Task<bool> CancelReservationAsync(int reservationId, int userId, string userRole)
    {
        await NormalizeDueReservationsAsync();
        var reservation = await _context.SeatReservations
            .Include(r => r.Seat)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
        {
            return false; // Reservation not found
        }

        if (reservation.UserId != userId && userRole != "Admin")
        {
            return false; // Unauthorized
        }

        if (reservation.Status != SeatReservationStatus.Active)
        {
            return false;
        }

        // Update status to Cancelled
        reservation.Status = SeatReservationStatus.Cancelled;
        await _context.SaveChangesAsync();

        if (reservation.UserId != userId)
        {
            await _notificationService.CreateNotificationAsync(
                reservation.UserId,
                "Seat Reservation Cancelled",
                $"Your seat reservation for {reservation.Seat.Label} on {reservation.Date:yyyy-MM-dd} has been cancelled.",
                "Info",
                "SeatReservation",
                reservation.Id);
        }

        return true;
    }

    public async Task<SeatReservationDto> CheckInAsync(int userId, SeatCheckInDto dto)
    {
        await NormalizeDueReservationsAsync();
        var today = GetTunisiaToday();

        var qrValue = dto.QrCodeValue?.Trim() ?? string.Empty;
        const string seatQrPrefix = "SEAT:";
        var scannedSeatId = 0;
        var hasValidSeatPayload =
            qrValue.StartsWith(seatQrPrefix, StringComparison.OrdinalIgnoreCase) &&
            int.TryParse(qrValue[seatQrPrefix.Length..], out scannedSeatId) &&
            scannedSeatId > 0;

        if (!hasValidSeatPayload)
            throw new FrontendValidationException(
                422,
                "Invalid seat QR code. Expected SEAT:{seatId}.",
                new[] { "INVALID_QR" }
            );

        var seat = await _context.Seats
            .FirstOrDefaultAsync(s => s.Id == scannedSeatId && s.IsActive);

        if (seat == null)
            throw new FrontendValidationException(
                422,
                "Invalid seat QR code.",
                new[] { "INVALID_QR" }
            );

        var reservation = await _context.SeatReservations
            .Include(r => r.Seat)
                .ThenInclude(s => s.OfficeTable)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r =>
                r.UserId == userId &&
                r.SeatId == seat.Id &&
                r.Date.Date == today);

        if (reservation == null)
            throw new FrontendValidationException(
                404,
                "No active reservation for this seat today.",
                new[] { "NO_RESERVATION" }
            );

        if (reservation.Status == SeatReservationStatus.CheckedIn)
            return _mapper.Map<SeatReservationDto>(reservation);

        if (reservation.Status != SeatReservationStatus.Active)
            throw new FrontendValidationException(
                409,
                "This reservation can no longer be checked in.",
                new[] { "CHECK_IN_NOT_ALLOWED" }
            );

        reservation.Status = SeatReservationStatus.CheckedIn;
        reservation.CheckedInAt = _timeProvider.TunisiaNow;

        await _context.SaveChangesAsync();

        return _mapper.Map<SeatReservationDto>(reservation);
    }

    public async Task<List<MonthCheckInDto>> GetMyMonthReservationsAsync(int userId, int year, int month)
    {
        await NormalizeDueReservationsAsync();
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

    public async Task NormalizeDueReservationsAsync()
    {
        var tunisiaToday = GetTunisiaToday();
        var isPastEndOfToday = _timeProvider.TunisiaCurrentTime >= EndOfDeskDay;
        var latestDueDate = isPastEndOfToday ? tunisiaToday : tunisiaToday.AddDays(-1);

        var dueReservations = await _context.SeatReservations
            .Where(r =>
                r.Date.Date <= latestDueDate &&
                (r.Status == SeatReservationStatus.Active ||
                 r.Status == SeatReservationStatus.CheckedIn))
            .ToListAsync();

        if (dueReservations.Count == 0)
        {
            return;
        }

        foreach (var reservation in dueReservations)
        {
            reservation.Status = reservation.Status == SeatReservationStatus.CheckedIn
                ? SeatReservationStatus.Completed
                : SeatReservationStatus.NoShow;
        }

        await _context.SaveChangesAsync();
    }

    private DateTime GetTunisiaToday() =>
        _timeProvider.TunisiaToday.ToDateTime(TimeOnly.MinValue);
}
