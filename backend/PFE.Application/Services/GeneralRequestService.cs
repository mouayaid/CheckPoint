using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.GeneralRequest;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class GeneralRequestService : IGeneralRequestService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public GeneralRequestService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<GeneralRequestDto?> CreateRequestAsync(int userId, CreateGeneralRequestDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        var request = new GeneralRequest
        {
            UserId = userId,
            Title = dto.Title,
            Description = dto.Description,
            Category = dto.Category,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.GeneralRequests.Add(request);
        await _context.SaveChangesAsync();

        // Notify admins based on category
        var admins = await _context.Users
            .Where(u => u.Role == Role.Admin)
            .ToListAsync();

        foreach (var admin in admins)
        {
            await _notificationService.CreateNotificationAsync(
                admin.Id,
                $"New {dto.Category} Request",
                $"{user.FullName} ({user.Department.Name}) has submitted a {dto.Category} request: {dto.Title}",
                "Info",
                "GeneralRequest",
                request.Id);
        }

        // Reload with includes for mapping
        var savedRequest = await _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == request.Id);

        return _mapper.Map<GeneralRequestDto>(savedRequest);
    }

    public async Task<List<GeneralRequestDto>> GetUserRequestsAsync(int userId)
    {
        var requests = await _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.AssignedToUser)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<GeneralRequestDto>>(requests);
    }

    public async Task<List<GeneralRequestDto>> GetAllRequestsAsync(RequestStatus? status, RequestCategory? category)
    {
        var query = _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.AssignedToUser)
            .AsQueryable();

        // Apply filters
        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        if (category.HasValue)
        {
            query = query.Where(r => r.Category == category.Value);
        }

        var requests = await query
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<GeneralRequestDto>>(requests);
    }

    public async Task<GeneralRequestDto?> AssignRequestAsync(int requestId, int adminId, AssignGeneralRequestDto dto)
    {
        var request = await _context.GeneralRequests
            .Include(r => r.User)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null)
        {
            return null;
        }

        // Update assignment and status
        request.AssignedToUserId = dto.AssignedToUserId;
        request.Status = dto.Status;

        await _context.SaveChangesAsync();

        // Notify the requester
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Request Assigned",
            $"Your {request.Category} request '{request.Title}' has been assigned{(dto.AssignedToUserId.HasValue ? $" to {request.AssignedToUser?.FullName}" : "")} and status updated to {dto.Status}.",
            "Info",
            "GeneralRequest",
            request.Id);

        // Notify assigned user if exists
        if (dto.AssignedToUserId.HasValue)
        {
            await _notificationService.CreateNotificationAsync(
                dto.AssignedToUserId.Value,
                "New Request Assignment",
                $"You have been assigned a {request.Category} request: {request.Title}",
                "Info",
                "GeneralRequest",
                request.Id);
        }

        // Reload with includes for mapping
        var savedRequest = await _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        return _mapper.Map<GeneralRequestDto>(savedRequest);
    }

    public async Task<GeneralRequestDto?> UpdateRequestStatusAsync(int requestId, int userId, UpdateGeneralRequestStatusDto dto)
    {
        var request = await _context.GeneralRequests
            .Include(r => r.User)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null)
        {
            return null;
        }

        // Check authorization: Only requester, assigned user, or admin can update status
        var user = await _context.Users.FindAsync(userId);
        var canUpdate = request.UserId == userId ||
                       request.AssignedToUserId == userId ||
                       (user != null && user.Role == Role.Admin);

        if (!canUpdate)
        {
            return null; // Unauthorized
        }

        var oldStatus = request.Status;
        request.Status = dto.Status;

        // If status is Resolved, set resolved timestamp (if we had that field)
        await _context.SaveChangesAsync();

        // Notify the requester
        var statusMessage = dto.Status switch
        {
            RequestStatus.InProgress => "is now in progress",
            RequestStatus.Resolved => "has been resolved",
            RequestStatus.Rejected => "has been rejected",
            _ => $"status updated to {dto.Status}"
        };

        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Request Status Updated",
            $"Your {request.Category} request '{request.Title}' {statusMessage}.{(string.IsNullOrEmpty(dto.Comment) ? "" : $" Comment: {dto.Comment}")}",
            dto.Status == RequestStatus.Resolved ? "Success" : dto.Status == RequestStatus.Rejected ? "Warning" : "Info",
            "GeneralRequest",
            request.Id);

        // Reload with includes for mapping
        var savedRequest = await _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        return _mapper.Map<GeneralRequestDto>(savedRequest);
    }
}

