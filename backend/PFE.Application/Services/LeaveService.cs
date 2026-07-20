using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.Leave;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using System.Data;
using RequestStatus = PFE.Domain.Enums.RequestStatus;

namespace PFE.Application.Services;

public class LeaveService : ILeaveService
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly IAppTimeProvider _timeProvider;

    public LeaveService(
        IApplicationDbContext context,
        INotificationService notificationService,
        IAppTimeProvider timeProvider)
    {
        _context = context;
        _notificationService = notificationService;
        _timeProvider = timeProvider;
    }

    public async Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId)
    {
        return await _context.LeaveRequests
            .Include(l => l.User)
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LeaveRequestDto
            {
                Id = l.Id,
                UserId = l.UserId,
                UserName = l.User.FullName,
                Type = l.Type,
                RequestedDays = l.RequestedDays,
                DayPeriod = l.DayPeriod,
                FromTime = l.FromTime,
                ToTime = l.ToTime,
                Status = l.Status,
                StartDate = l.StartDate,
                EndDate = l.EndDate,
                Reason = l.Reason,
                ManagerComment = l.ManagerComment,
                CreatedAt = l.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<LeaveRequestDto> CreateLeaveRequestAsync(int userId, CreateLeaveRequestDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new NotFoundException("User not found.");

        if (IsAdminUser(user))
            throw new BadRequestException("Admin users cannot have leave balance.");

        ValidateLeaveRequest(dto, _timeProvider.TunisiaToday);
        var requestedDays = CalculateRequestedDays(dto.Type, dto.StartDate, dto.EndDate);
        var shouldCheckBalance = ShouldDeductFromBalance(dto.Type);

        var pendingRequests = await _context.LeaveRequests
            .Where(l => l.UserId == userId && l.Status == RequestStatus.Pending)
            .ToListAsync();

        var pendingDays = pendingRequests
            .Where(l => ShouldDeductFromBalance(l.Type))
            .Sum(l => l.RequestedDays > 0
                ? l.RequestedDays
                : CalculateRequestedDays(l.Type, l.StartDate, l.EndDate));

        if (shouldCheckBalance && (user.LeaveBalance ?? 0) < requestedDays + pendingDays)
            throw new BadRequestException("Votre solde de congés est insuffisant.");

        var potentiallyOverlappingRequests = await _context.LeaveRequests
            .Where(l =>
                l.UserId == userId &&
                (l.Status == RequestStatus.Pending || l.Status == RequestStatus.Approved) &&
                dto.StartDate.Date <= l.EndDate.Date &&
                dto.EndDate.Date >= l.StartDate.Date)
            .ToListAsync();

        var hasOverlap = potentiallyOverlappingRequests.Any(existing =>
            RequestsOverlap(existing, dto));

        if (hasOverlap)
            throw new BadRequestException("Vous avez déjà une demande de congé en attente ou approuvée qui chevauche ces dates.");

        var leaveRequest = new LeaveRequest
        {
            UserId = userId,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Type = dto.Type,
            RequestedDays = requestedDays,
            DayPeriod = IsHalfDayLeave(dto.Type) ? dto.DayPeriod : null,
            FromTime = IsHalfDayLeave(dto.Type) ? dto.FromTime : null,
            ToTime = IsHalfDayLeave(dto.Type) ? dto.ToTime : null,
            Reason = dto.Reason,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.LeaveRequests.Add(leaveRequest);
        await _context.SaveChangesAsync();

        var admins = await _context.Users
            .Where(u => u.Role.Name == "Admin" && u.IsActive)
            .ToListAsync();

        foreach (var admin in admins)
        {
            await _notificationService.CreateNotificationAsync(
                admin.Id,
                "New Leave Request",
                $"{user.FullName} ({user.Department?.Name ?? "No department"}) has submitted a leave request from {dto.StartDate:yyyy-MM-dd} to {dto.EndDate:yyyy-MM-dd}. Reason: {dto.Reason}",
                "Info",
                "LeaveRequest",
                leaveRequest.Id);
        }

        var createdRequest = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstAsync(l => l.Id == leaveRequest.Id);

        return MapToDto(createdRequest);
    }

    public async Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForReviewerAsync(int reviewerId)
    {
        var reviewer = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
            return new List<LeaveRequestDto>();

        IQueryable<LeaveRequest> query = _context.LeaveRequests
            .Include(l => l.User)
            .Where(l => l.Status == RequestStatus.Pending);

        if (reviewer.Role.Name != "Admin")
        {
            return new List<LeaveRequestDto>();
        }

        var requests = await query
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return requests.Select(MapToDto).ToList();
    }

    public async Task<LeaveRequestDto?> ApproveLeaveRequestAsync(int id, int reviewerId, ApproveLeaveRequestDto dto)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable);

        var reviewer = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
            return null;

        var request = await _context.LeaveRequests
            .AsNoTracking()
            .Include(l => l.User)
                .ThenInclude(u => u.Role)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new ConflictException("Cette demande de congé a déjà été traitée.");

        if (reviewer.Role.Name != "Admin")
            return null;

        if (IsAdminUser(request.User))
            throw new BadRequestException("Admin users cannot have leave balance.");

        var shouldDeductBalance = ShouldDeductFromBalance(request.Type);
        var deductionAmount = GetBalanceDeductionAmount(request);

        if (shouldDeductBalance && (request.User.LeaveBalance ?? 0) < deductionAmount)
            throw new BadRequestException("Votre solde de congés est insuffisant.");

        var reviewedAt = DateTime.UtcNow;
        var reviewedRows = await _context.LeaveRequests
            .Where(l => l.Id == id && l.Status == RequestStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(l => l.Status, RequestStatus.Approved)
                .SetProperty(l => l.ManagerComment, dto.Comment)
                .SetProperty(l => l.ReviewedAt, reviewedAt)
                .SetProperty(l => l.ReviewedById, reviewerId));

        if (reviewedRows == 0)
            throw new ConflictException("Cette demande de congé a déjà été traitée.");

        if (shouldDeductBalance)
        {
            var balanceRows = await _context.Users
                .Where(u =>
                    u.Id == request.UserId &&
                    (u.LeaveBalance ?? 0) >= deductionAmount)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(
                        u => u.LeaveBalance,
                        u => (u.LeaveBalance ?? 0) - deductionAmount));

            if (balanceRows == 0)
                throw new BadRequestException("Votre solde de congés est insuffisant.");
        }

        await transaction.CommitAsync();

        var reviewedRequest = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstAsync(l => l.Id == id);

        if (reviewedRequest.User.IsActive &&
            reviewedRequest.User.ApprovedAt != null &&
            reviewedRequest.User.RejectedAt == null)
        {
            await _notificationService.CreateNotificationAsync(
                reviewedRequest.UserId,
                "Leave Request Approved",
                $"Your leave request from {reviewedRequest.StartDate:yyyy-MM-dd} to {reviewedRequest.EndDate:yyyy-MM-dd} has been approved.{(string.IsNullOrEmpty(dto.Comment) ? "" : $" Comment: {dto.Comment}")}",
                "Success",
                "LeaveRequest",
                reviewedRequest.Id);
        }

        return MapToDto(reviewedRequest);
    }

    public async Task<LeaveRequestDto?> RejectLeaveRequestAsync(int id, int reviewerId, RejectLeaveRequestDto dto)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable);

        var reviewer = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
            return null;

        var request = await _context.LeaveRequests
            .AsNoTracking()
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new ConflictException("Cette demande de congé a déjà été traitée.");

        if (reviewer.Role.Name != "Admin")
            return null;

        var reviewedAt = DateTime.UtcNow;
        var reviewedRows = await _context.LeaveRequests
            .Where(l => l.Id == id && l.Status == RequestStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(l => l.Status, RequestStatus.Rejected)
                .SetProperty(l => l.ManagerComment, dto.Comment)
                .SetProperty(l => l.ReviewedAt, reviewedAt)
                .SetProperty(l => l.ReviewedById, reviewerId));

        if (reviewedRows == 0)
            throw new ConflictException("Cette demande de congé a déjà été traitée.");

        await transaction.CommitAsync();

        var reviewedRequest = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstAsync(l => l.Id == id);

        if (reviewedRequest.User.IsActive &&
            reviewedRequest.User.ApprovedAt != null &&
            reviewedRequest.User.RejectedAt == null)
        {
            await _notificationService.CreateNotificationAsync(
                reviewedRequest.UserId,
                "Leave Request Rejected",
                $"Your leave request from {reviewedRequest.StartDate:yyyy-MM-dd} to {reviewedRequest.EndDate:yyyy-MM-dd} has been rejected.{(string.IsNullOrEmpty(dto.Comment) ? "" : $" Comment: {dto.Comment}")}",
                "Warning",
                "LeaveRequest",
                reviewedRequest.Id);
        }

        return MapToDto(reviewedRequest);
    }

    public async Task<LeaveRequestDto?> CancelLeaveRequestAsync(int id, int userId)
    {
        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new Exception("Seules les demandes de congé en attente peuvent être annulées.");

        request.Status = RequestStatus.Cancelled;
        await _context.SaveChangesAsync();

        return MapToDto(request);
    }

    private static decimal CalculateRequestedDays(LeaveType type, DateTime startDate, DateTime endDate)
    {
        if (IsHalfDayLeave(type))
            return 0.5m;

        var workingDays = 0;

        for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
        {
            if (date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                workingDays++;
        }

        return workingDays;
    }

    private static bool IsHalfDayLeave(LeaveType type)
    {
        return type is LeaveType.HalfDayPaidLeave or LeaveType.HalfDayUnpaidLeave;
    }

    private static bool ShouldDeductFromBalance(LeaveType type)
    {
        return type is LeaveType.PaidLeave or LeaveType.HalfDayPaidLeave;
    }

    private static bool IsAdminUser(User user)
    {
        return user.RoleId == 3 ||
            string.Equals(user.Role?.Name, "Admin", StringComparison.OrdinalIgnoreCase);
    }

    private static decimal GetBalanceDeductionAmount(LeaveRequest request)
    {
        return request.Type switch
        {
            LeaveType.HalfDayPaidLeave => 0.5m,
            LeaveType.PaidLeave when request.RequestedDays is > 0 => request.RequestedDays.Value,
            LeaveType.PaidLeave => CalculateRequestedDays(
                request.Type,
                request.StartDate,
                request.EndDate),
            _ => 0m
        };
    }

    private static bool RequestsOverlap(LeaveRequest existing, CreateLeaveRequestDto incoming)
    {
        if (!IsHalfDayLeave(existing.Type) || !IsHalfDayLeave(incoming.Type))
            return true;

        if (existing.StartDate.Date != incoming.StartDate.Date)
            return false;

        return existing.DayPeriod == null ||
            incoming.DayPeriod == null ||
            existing.DayPeriod == incoming.DayPeriod;
    }

    private static void ValidateLeaveRequest(CreateLeaveRequestDto dto, DateOnly tunisiaToday)
    {
        if (!Enum.IsDefined(typeof(LeaveType), dto.Type))
            throw new BadRequestException("Veuillez sélectionner un type de congé.");

        if (string.IsNullOrWhiteSpace(dto.Reason))
            throw new BadRequestException("Veuillez saisir le motif de votre demande.");

        if (DateOnly.FromDateTime(dto.StartDate.Date) < tunisiaToday)
            throw new BadRequestException("La date de début ne peut pas être dans le passé.");

        if (dto.EndDate.Date < dto.StartDate.Date)
            throw new BadRequestException("La date de fin doit être après la date de début.");

        if (!IsHalfDayLeave(dto.Type))
        {
            if (CalculateRequestedDays(dto.Type, dto.StartDate, dto.EndDate) <= 0)
                throw new BadRequestException("La période de congé doit contenir au moins un jour ouvrable.");

            return;
        }

        if (dto.StartDate.Date != dto.EndDate.Date)
            throw new BadRequestException("Une demi-journée doit commencer et se terminer le même jour.");

        if (dto.DayPeriod == null || !Enum.IsDefined(typeof(HalfDayPeriod), dto.DayPeriod.Value))
            throw new BadRequestException("Veuillez sélectionner la période : matin ou après-midi.");

        if (dto.FromTime == null || dto.ToTime == null)
            throw new BadRequestException("Veuillez renseigner les heures De et À.");

        var expectedTimes = dto.DayPeriod == HalfDayPeriod.Morning
            ? (From: new TimeSpan(8, 0, 0), To: new TimeSpan(12, 0, 0))
            : (From: new TimeSpan(13, 0, 0), To: new TimeSpan(17, 0, 0));

        if (dto.FromTime != expectedTimes.From || dto.ToTime != expectedTimes.To)
            throw new BadRequestException(
                dto.DayPeriod == HalfDayPeriod.Morning
                    ? "La demi-journée du matin doit être de 08:00 à 12:00."
                    : "La demi-journée de l'après-midi doit être de 13:00 à 17:00.");
    }

    private static LeaveRequestDto MapToDto(LeaveRequest request)
    {
        return new LeaveRequestDto
        {
            Id = request.Id,
            UserId = request.UserId,
            UserName = request.User.FullName,
            Type = request.Type,
            RequestedDays = request.RequestedDays,
            DayPeriod = request.DayPeriod,
            FromTime = request.FromTime,
            ToTime = request.ToTime,
            Status = request.Status,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Reason = request.Reason,
            ManagerComment = request.ManagerComment,
            CreatedAt = request.CreatedAt
        };
    }
}
