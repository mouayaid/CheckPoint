using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Leave;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class LeaveRequestService : ILeaveRequestService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public LeaveRequestService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService)
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
            return null;
        }
         var tz = TimeZoneInfo.FindSystemTimeZoneById("Africa/Tunis");
    var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;

    var start = dto.StartDate.Date;
    var end = dto.EndDate.Date;

    // ✅ Validations
    if (start < today)
        throw new ArgumentException("StartDate cannot be in the past.");

    if (end < start)
        throw new ArgumentException("EndDate must be the same day or after StartDate.");

        // Find manager in the same department (first Manager or Admin)
        var manager = await _context.Users
            .FirstOrDefaultAsync(u => u.DepartmentId == user.DepartmentId &&
                                     (u.Role == Role.Manager || u.Role == Role.Admin));

        var leaveRequest = new LeaveRequest
        {
            UserId = userId,
            ManagerId = manager?.Id,
            StartDate = dto.StartDate.Date,
            EndDate = dto.EndDate.Date,
            Type = dto.Type,
            Reason = dto.Reason,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.LeaveRequests.Add(leaveRequest);
        await _context.SaveChangesAsync();

        // Notify manager if exists
        if (manager != null)
        {
            await _notificationService.CreateNotificationAsync(
                manager.Id,
                "New Leave Request",
                $"{user.FullName} ({user.Department.Name}) has submitted a leave request from {dto.StartDate:yyyy-MM-dd} to {dto.EndDate:yyyy-MM-dd}",
                "Info",
                "LeaveRequest",
                leaveRequest.Id);
        }

        // Reload with includes for mapping
        var savedRequest = await _context.LeaveRequests
            .Include(l => l.User)
                .ThenInclude(u => u.Department)
            .Include(l => l.Manager)
            .FirstOrDefaultAsync(l => l.Id == leaveRequest.Id);

        return _mapper.Map<LeaveRequestDto>(savedRequest);
    }

    public async Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId)
    {
        var requests = await _context.LeaveRequests
            .Include(l => l.User)
                .ThenInclude(u => u.Department)
            .Include(l => l.Manager)
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<LeaveRequestDto>>(requests);
    }

    public async Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForTeamAsync(int managerId)
    {
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null)
        {
            return new List<LeaveRequestDto>();
        }

        // Get pending requests from employees in the same department
        var requests = await _context.LeaveRequests
            .Include(l => l.User)
                .ThenInclude(u => u.Department)
            .Include(l => l.Manager)
            .Where(l => l.Status == RequestStatus.Pending &&
                       l.User.DepartmentId == manager.DepartmentId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<LeaveRequestDto>>(requests);
    }
}

