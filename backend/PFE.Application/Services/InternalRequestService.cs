using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.InternalRequest;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class InternalRequestService : IInternalRequestService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public InternalRequestService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<InternalRequestDto?> CreateRequestAsync(int userId, CreateInternalRequestDto dto)
    {
        // Map "InternalRequest" feature to your real entity: GeneralRequest
        var request = new GeneralRequest
        {
            UserId = userId,
            Category = Enum.Parse<RequestCategory>(dto.Category, ignoreCase: true),
            Title = dto.Title,
            Description = dto.Description,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.GeneralRequests.Add(request);
        await _context.SaveChangesAsync();

        // Notify admins (Role is enum, and your User doesn't have IsActive)
        var admins = await _context.Users
            .Where(u => u.Role == Role.Admin)
            .ToListAsync();

        foreach (var admin in admins)
        {
            await _notificationService.CreateNotificationAsync(
                admin.Id,
                $"New {dto.Category} Request",
                dto.Title,
                "Info",
                "GeneralRequest",
                request.Id);
        }

        var created = await _context.GeneralRequests
            .Include(r => r.User)
            .Include(r => r.AssignedTo)
            .FirstOrDefaultAsync(r => r.Id == request.Id);

        return created == null ? null : _mapper.Map<InternalRequestDto>(created);
    }

    public async Task<List<InternalRequestDto>> GetUserRequestsAsync(int userId)
    {
        var requests = await _context.GeneralRequests
            .Include(r => r.User)
            .Include(r => r.AssignedTo)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<InternalRequestDto>>(requests);
    }

    public async Task<List<InternalRequestDto>> GetRequestsByCategoryAsync(string category)
    {
        if (!Enum.TryParse<RequestCategory>(category, ignoreCase: true, out var parsedCategory))
        {
            return new List<InternalRequestDto>(); // or throw an exception
        }
        var requests = await _context.GeneralRequests
            .Include(r => r.User)
            .Include(r => r.AssignedTo)
            .Where(r => r.Category == parsedCategory)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<InternalRequestDto>>(requests);
    }

    public async Task<InternalRequestDto?> UpdateRequestStatusAsync(
        int requestId,
        string status,
        string? comment,
        int? assignedToId)
    {
        var request = await _context.GeneralRequests
            .Include(r => r.User)
            .Include(r => r.AssignedTo)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null) return null;

        // Your domain uses enums for Status, so parse safely
        if (!Enum.TryParse<RequestStatus>(status, ignoreCase: true, out var parsedStatus))
        {
            // if invalid string passed, keep current status (or choose to throw)
            parsedStatus = request.Status;
        }

        request.Status = parsedStatus;
        request.AssignedToUserId = assignedToId;

        // Optional fields: only set them if they exist in your entity
        // If your GeneralRequest entity doesn't have AdminComment/ResolvedAt, delete these lines.
        request.AdminComment = comment;
        request.ResolvedAt = parsedStatus == RequestStatus.Approved ? DateTime.UtcNow : null;

        await _context.SaveChangesAsync();

        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Request Status Updated",
            $"Your {request.Category} request is now {request.Status}",
            request.Status == RequestStatus.Approved ? "Success" : "Info",
            "GeneralRequest",
            request.Id);

        return _mapper.Map<InternalRequestDto>(request);
    }
}
