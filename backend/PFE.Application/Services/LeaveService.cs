using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Leave;
using PFE.Domain.Entities;
using RequestStatus = PFE.Domain.Enums.RequestStatus;

namespace PFE.Application.Services;

public class LeaveService : ILeaveService
{
    private readonly IApplicationDbContext _context;

    public LeaveService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId)
    {
        return await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.AssignedManager)
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LeaveRequestDto
            {
                Id = l.Id,
                UserId = l.UserId,
                UserName = l.User.FullName,
                AssignedManagerId = l.AssignedManagerId,
                AssignedManagerName = l.AssignedManager != null ? l.AssignedManager.FullName : null,
                Type = l.Type,
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
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new Exception("User not found.");

        if (dto.StartDate.Date < DateTime.UtcNow.Date)
            throw new Exception("Start date cannot be in the past.");

        if (dto.EndDate.Date < dto.StartDate.Date)
            throw new Exception("End date cannot be before start date.");

        var requestedDays = CalculateLeaveDays(dto.StartDate, dto.EndDate);

        var pendingRequests = await _context.LeaveRequests
            .Where(l => l.UserId == userId && l.Status == RequestStatus.Pending)
            .ToListAsync();

        var pendingDays = pendingRequests.Sum(l => CalculateLeaveDays(l.StartDate, l.EndDate));
        if (user.LeaveBalance < requestedDays + pendingDays)
            throw new Exception("Not enough leave balance considering your pending requests.");

        int? assignedManagerId = null;

        if (user.Role.Name == "Employee")
        {
            var manager = await _context.Users
                .Include(u => u.Role)
                .Where(u => u.Role.Name == "Manager" && u.IsActive)
                .OrderBy(u => u.Id)
                .FirstOrDefaultAsync();

            assignedManagerId = manager?.Id;
        }

        var leaveRequest = new LeaveRequest
        {
            UserId = userId,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Type = dto.Type,
            Reason = dto.Reason,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            AssignedManagerId = assignedManagerId
        };

        _context.LeaveRequests.Add(leaveRequest);
        await _context.SaveChangesAsync();

        var createdRequest = await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.AssignedManager)
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
            .Include(l => l.AssignedManager)
            .Where(l => l.Status == RequestStatus.Pending);

        if (reviewer.Role.Name == "Manager")
        {
            query = query.Where(l => l.AssignedManagerId == reviewerId);
        }
        else if (reviewer.Role.Name != "Admin")
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
            .Include(l => l.AssignedManager)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new Exception("This leave request has already been reviewed.");

        if (reviewer.Role.Name == "Manager" && request.AssignedManagerId != reviewerId)
            return null;

        if (reviewer.Role.Name != "Manager" && reviewer.Role.Name != "Admin")
            return null;

        var requestedDays = CalculateLeaveDays(request.StartDate, request.EndDate);

        if (request.User.LeaveBalance < requestedDays)
            throw new Exception("Not enough leave balance.");

        request.Status = RequestStatus.Approved;
        request.ManagerComment = dto.Comment;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedById = reviewerId;
        request.User.LeaveBalance -= requestedDays;

        await _context.SaveChangesAsync();

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
            .Include(l => l.AssignedManager)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
            return null;

        if (request.Status != RequestStatus.Pending)
            throw new Exception("This leave request has already been reviewed.");

        if (reviewer.Role.Name == "Manager" && request.AssignedManagerId != reviewerId)
            return null;

        if (reviewer.Role.Name != "Manager" && reviewer.Role.Name != "Admin")
            return null;

        request.Status = RequestStatus.Rejected;
        request.ManagerComment = dto.Comment;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedById = reviewerId;

        await _context.SaveChangesAsync();

        return MapToDto(request);
    }

    private static int CalculateLeaveDays(DateTime startDate, DateTime endDate)
    {
        return (endDate.Date - startDate.Date).Days + 1;
    }

    private static LeaveRequestDto MapToDto(LeaveRequest request)
    {
        return new LeaveRequestDto
        {
            Id = request.Id,
            UserId = request.UserId,
            UserName = request.User.FullName,
            AssignedManagerId = request.AssignedManagerId,
            AssignedManagerName = request.AssignedManager != null ? request.AssignedManager.FullName : null,
            Type = request.Type,
            Status = request.Status,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Reason = request.Reason,
            ManagerComment = request.ManagerComment,
            CreatedAt = request.CreatedAt
        };
    }
}