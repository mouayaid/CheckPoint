using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.Leave;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class LeaveService : ILeaveService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public LeaveService(IApplicationDbContext context, IMapper mapper, INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }


    public async Task<LeaveRequestDto?> CreateLeaveRequestAsync(int userId, CreateLeaveRequestDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            throw new FrontendValidationException(
                404,
                "User not found.",
                new[] { "USER_NOT_FOUND" }
            );
        }

        if (!user.IsActive)
        {
            throw new FrontendValidationException(
                403,
                "Your account is not active yet.",
                new[] { "USER_INACTIVE" }
            );
        }

        var today = GetTunisiaNow().Date;
        var start = dto.StartDate.Date;
        var end = dto.EndDate.Date;

        if (start < today)
        {
            throw new FrontendValidationException(
                400,
                $"Start date cannot be in the past. (Server today: {today:yyyy-MM-dd})",
                new[] { "START_DATE_IN_PAST" }
            );
        }

        if (end < start)
        {
            throw new FrontendValidationException(
                400,
                "End date must be the same day or after start date.",
                new[] { "END_BEFORE_START" }
            );
        }

        // Calculate requested leave days (calendar days)
        var requestedDays = (end - start).Days + 1;
        if (requestedDays <= 0)
        {
            throw new FrontendValidationException(
                400,
                "Invalid date range.",
                new[] { "INVALID_DATE_RANGE" }
            );
        }

        var currentBalance = user.LeaveBalance ?? 0;
        if (currentBalance < requestedDays)
        {
            throw new FrontendValidationException(
                409,
                $"Insufficient leave balance. Requested {requestedDays} day(s), available {currentBalance}.",
                new[] { "INSUFFICIENT_LEAVE_BALANCE" }
            );
        }

        // Find a manager in the same department
        int? managerId = await _context.Users
            .Where(u => u.Role == Role.Manager && u.DepartmentId == user.DepartmentId)
            .Select(u => (int?)u.Id)
            .FirstOrDefaultAsync();

        var leaveRequest = new LeaveRequest
        {
            UserId = userId,
            ManagerId = managerId,
            Type = dto.Type,
            StartDate = start,
            EndDate = end,
            Reason = dto.Reason,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.LeaveRequests.Add(leaveRequest);
        await _context.SaveChangesAsync();

        // Notify manager if exists
        if (managerId.HasValue)
        {
            await _notificationService.CreateNotificationAsync(
                managerId.Value,
                "New Leave Request",
                $"{user.FullName} has submitted a leave request",
                "Info",
                "LeaveRequest",
                leaveRequest.Id);
        }

        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.Manager)
            .FirstOrDefaultAsync(l => l.Id == leaveRequest.Id);

        return request == null ? null : _mapper.Map<LeaveRequestDto>(request);
    }

    public async Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId)
    {
        var requests = await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.Manager)
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<LeaveRequestDto>>(requests);
    }

    public async Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForManagerAsync(int managerId)
    {
        var requests = await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.Manager)
            .Where(l => l.ManagerId == managerId && l.Status == RequestStatus.Pending)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<LeaveRequestDto>>(requests);
    }

    public async Task<bool> ReviewLeaveRequestAsync(int requestId, int managerId, ReviewLeaveRequestDto dto)
    {
        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == requestId && l.ManagerId == managerId);

        if (request == null || request.Status != RequestStatus.Pending)
            return false;

        var user = request.User;
        if (user == null)
            return false;

        // If manager wants to approve, check balance first
        if (dto.Status == RequestStatus.Approved)
        {
            var days = (request.EndDate - request.StartDate).Days + 1;
            var currentBalance = user.LeaveBalance ?? 0;

            // Block approval if balance is not enough
            if (currentBalance < days)
            {
                throw new FrontendValidationException(
                    409,
                    $"Cannot approve: user has insufficient leave balance. Needed {days}, available {currentBalance}.",
                    new[] { "INSUFFICIENT_LEAVE_BALANCE" }
                );
            }

            user.LeaveBalance = currentBalance - days;
        }

        request.Status = dto.Status;

        await _context.SaveChangesAsync();

        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Leave Request Reviewed",
            $"Your leave request is now {request.Status}",
            request.Status == RequestStatus.Approved ? "Success" : "Warning",
            "LeaveRequest",
            request.Id);

        return true;
    }

    // ✅ Cross-platform Tunisia time helper (same pattern used in seat/room modules)
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