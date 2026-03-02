using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
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
        // You don't have User.Manager navigation, so don't Include(u => u.Manager)
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return null;

        // You need a manager id. If your User entity doesn't have ManagerId,
        // you can pick any manager from same department as a first step.
        int? managerId = await _context.Users
            .Where(u => u.Role == Role.Manager && u.DepartmentId == user.DepartmentId)
            .Select(u => (int?)u.Id)
            .FirstOrDefaultAsync();

        var leaveRequest = new LeaveRequest
        {
            UserId = userId,
            ManagerId = managerId,
            Type = dto.Type,                 // must be LeaveType (enum)
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Status = RequestStatus.Pending,  // enum, not string
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

        request.Status = dto.Status; // must be RequestStatus enum
        await _context.SaveChangesAsync();

        // Notify user
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Leave Request Reviewed",
            $"Your leave request is now {request.Status}",
            request.Status == RequestStatus.Approved ? "Success" : "Warning",
            "LeaveRequest",
            request.Id);

        return true;
    }
}