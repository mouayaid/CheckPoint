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
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return null;

        // Validate dates
        if (dto.EndDate < dto.StartDate)
            return null;

        // Calculate requested leave days (calendar days)
        var requestedDays = (dto.EndDate - dto.StartDate).Days + 1;

        // Block request if user has no balance or insufficient balance
        var currentBalance = user.LeaveBalance ?? 0;
        if (currentBalance <= 0 || currentBalance < requestedDays)
            return null;

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
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
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
                return false;
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
}