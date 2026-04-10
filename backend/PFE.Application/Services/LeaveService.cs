using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Leave;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

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
        var requests = await _context.LeaveRequests
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

        return requests;
    }

    public async Task<LeaveRequestDto> CreateLeaveRequestAsync(int userId, CreateLeaveRequestDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            throw new Exception("User not found.");
        }

        int? assignedManagerId = null;

        if (user.Role == Role.Employee)
        {
            var manager = await _context.Users
                .Where(u => u.Role == Role.Manager && u.IsActive)
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

        return new LeaveRequestDto
        {
            Id = createdRequest.Id,
            UserId = createdRequest.UserId,
            UserName = createdRequest.User.FullName,
            AssignedManagerId = createdRequest.AssignedManagerId,
            AssignedManagerName = createdRequest.AssignedManager != null ? createdRequest.AssignedManager.FullName : null,
            Type = createdRequest.Type,
            Status = createdRequest.Status,
            StartDate = createdRequest.StartDate,
            EndDate = createdRequest.EndDate,
            Reason = createdRequest.Reason,
            ManagerComment = createdRequest.ManagerComment,
            CreatedAt = createdRequest.CreatedAt
        };
    }

    public async Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForReviewerAsync(int reviewerId)
    {
        var reviewer = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
        {
            return new List<LeaveRequestDto>();
        }

        IQueryable<LeaveRequest> query = _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.AssignedManager)
            .Where(l => l.Status == RequestStatus.Pending);

        if (reviewer.Role == Role.Manager)
        {
            query = query.Where(l => l.AssignedManagerId == reviewerId);
        }
        else if (reviewer.Role != Role.Admin)
        {
            return new List<LeaveRequestDto>();
        }

        var requests = await query
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

        return requests;
    }

    public async Task<LeaveRequestDto?> ApproveLeaveRequestAsync(int id, int reviewerId, ApproveLeaveRequestDto dto)
    {
        var reviewer = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
        {
            return null;
        }

        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.AssignedManager)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
        {
            return null;
        }

        if (reviewer.Role == Role.Manager && request.AssignedManagerId != reviewerId)
        {
            return null;
        }

        if (reviewer.Role != Role.Manager && reviewer.Role != Role.Admin)
        {
            return null;
        }

        request.Status = RequestStatus.Approved;
        request.ManagerComment = dto.Comment;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedById = reviewerId;

        await _context.SaveChangesAsync();

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

    public async Task<LeaveRequestDto?> RejectLeaveRequestAsync(int id, int reviewerId, RejectLeaveRequestDto dto)
    {
        var reviewer = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == reviewerId);

        if (reviewer == null)
        {
            return null;
        }

        var request = await _context.LeaveRequests
            .Include(l => l.User)
            .Include(l => l.AssignedManager)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (request == null)
        {
            return null;
        }

        if (reviewer.Role == Role.Manager && request.AssignedManagerId != reviewerId)
        {
            return null;
        }

        if (reviewer.Role != Role.Manager && reviewer.Role != Role.Admin)
        {
            return null;
        }

        request.Status = RequestStatus.Rejected;
        request.ManagerComment = dto.Comment;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedById = reviewerId;

        await _context.SaveChangesAsync();

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