using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Leave;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using RequestStatus = PFE.Domain.Enums.RequestStatus;

namespace PFE.Application.Services;

public class LeaveService : ILeaveService
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public LeaveService(
        IApplicationDbContext context,
        INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId)
    {
        return await _context.LeaveRequests
            .Include(l => l.User)
            .Where(l => l.UserId == userId && l.Status != RequestStatus.Cancelled)
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
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new Exception("User not found.");

        ValidateLeaveRequest(dto);
        var requestedDays = CalculateRequestedDays(dto.Type, dto.StartDate, dto.EndDate);
        var shouldCheckBalance = DeductsPaidLeaveBalance(dto.Type);

        var pendingRequests = await _context.LeaveRequests
            .Where(l => l.UserId == userId && l.Status == RequestStatus.Pending)
            .ToListAsync();

        var pendingDays = pendingRequests
            .Where(l => DeductsPaidLeaveBalance(l.Type))
            .Sum(l => l.RequestedDays > 0
                ? l.RequestedDays
                : CalculateRequestedDays(l.Type, l.StartDate, l.EndDate));

        if (shouldCheckBalance && (user.LeaveBalance ?? 0) < requestedDays + pendingDays)
            throw new Exception("Votre solde de congés est insuffisant.");

        var hasOverlap = await _context.LeaveRequests
            .AnyAsync(l =>
                l.UserId == userId &&
                (l.Status == RequestStatus.Pending || l.Status == RequestStatus.Approved) &&
                dto.StartDate.Date <= l.EndDate.Date &&
                dto.EndDate.Date >= l.StartDate.Date);

        if (hasOverlap)
            throw new Exception("Vous avez déjà une demande de congé en attente ou approuvée qui chevauche ces dates.");

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
        var reviewer = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
            return null;

        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new Exception("Cette demande de congé a déjà été traitée.");

        if (reviewer.Role.Name != "Admin")
            return null;

        var requestedDays = request.RequestedDays > 0
            ? request.RequestedDays
            : CalculateRequestedDays(request.Type, request.StartDate, request.EndDate);
        var canDeductBalance = DeductsPaidLeaveBalance(request.Type);

        if (dto.DeductFromLeaveBalance && !canDeductBalance)
            throw new Exception("Ce type de congé ne réduit pas le solde de congés payés.");

        if (canDeductBalance && (request.User.LeaveBalance ?? 0) < requestedDays)
            throw new Exception("Votre solde de congés est insuffisant.");

        request.Status = RequestStatus.Approved;
        request.ManagerComment = dto.Comment;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedById = reviewerId;

        if (canDeductBalance)
        {
            request.User.LeaveBalance = (request.User.LeaveBalance ?? 0) - requestedDays;
        }

        await _context.SaveChangesAsync();

        if (request.User.IsActive &&
            request.User.ApprovedAt != null &&
            request.User.RejectedAt == null)
        {
            await _notificationService.CreateNotificationAsync(
                request.UserId,
                "Leave Request Approved",
                $"Your leave request from {request.StartDate:yyyy-MM-dd} to {request.EndDate:yyyy-MM-dd} has been approved.{(string.IsNullOrEmpty(dto.Comment) ? "" : $" Comment: {dto.Comment}")}",
                "Success",
                "LeaveRequest",
                request.Id);
        }

        return MapToDto(request);
    }

    public async Task<LeaveRequestDto?> RejectLeaveRequestAsync(int id, int reviewerId, RejectLeaveRequestDto dto)
    {
        var reviewer = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
            return null;

        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new Exception("Cette demande de congé a déjà été traitée.");

        if (reviewer.Role.Name != "Admin")
            return null;

        request.Status = RequestStatus.Rejected;
        request.ManagerComment = dto.Comment;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedById = reviewerId;

        await _context.SaveChangesAsync();

        if (request.User.IsActive &&
            request.User.ApprovedAt != null &&
            request.User.RejectedAt == null)
        {
            await _notificationService.CreateNotificationAsync(
                request.UserId,
                "Leave Request Rejected",
                $"Your leave request from {request.StartDate:yyyy-MM-dd} to {request.EndDate:yyyy-MM-dd} has been rejected.{(string.IsNullOrEmpty(dto.Comment) ? "" : $" Comment: {dto.Comment}")}",
                "Warning",
                "LeaveRequest",
                request.Id);
        }

        return MapToDto(request);
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

        return (endDate.Date - startDate.Date).Days + 1;
    }

    private static bool IsHalfDayLeave(LeaveType type)
    {
        return type is LeaveType.HalfDayPaidLeave or LeaveType.HalfDayUnpaidLeave;
    }

    private static bool DeductsPaidLeaveBalance(LeaveType type)
    {
        return type is LeaveType.PaidLeave or LeaveType.HalfDayPaidLeave;
    }

    private static void ValidateLeaveRequest(CreateLeaveRequestDto dto)
    {
        if (!Enum.IsDefined(typeof(LeaveType), dto.Type))
            throw new Exception("Veuillez sélectionner un type de congé.");

        if (string.IsNullOrWhiteSpace(dto.Reason))
            throw new Exception("Veuillez saisir le motif de votre demande.");

        if (dto.StartDate.Date < DateTime.UtcNow.Date)
            throw new Exception("La date de début ne peut pas être dans le passé.");

        if (dto.EndDate.Date < dto.StartDate.Date)
            throw new Exception("La date de fin doit être après la date de début.");

        if (!IsHalfDayLeave(dto.Type))
            return;

        if (dto.StartDate.Date != dto.EndDate.Date)
            throw new Exception("Une demi-journée doit commencer et se terminer le même jour.");

        if (dto.DayPeriod == null || !Enum.IsDefined(typeof(HalfDayPeriod), dto.DayPeriod.Value))
            throw new Exception("Veuillez sélectionner la période : matin ou après-midi.");

        if (dto.FromTime == null || dto.ToTime == null)
            throw new Exception("Veuillez renseigner les heures De et À.");

        if (dto.FromTime >= dto.ToTime)
            throw new Exception("L'heure de fin doit être supérieure à l'heure de début.");
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
