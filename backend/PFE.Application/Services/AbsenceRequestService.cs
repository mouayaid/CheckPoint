using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.AbsenceRequest;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class AbsenceRequestService : IAbsenceRequestService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public AbsenceRequestService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<AbsenceRequestDto?> CreateAbsenceRequestAsync(int userId, CreateAbsenceRequestDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        // Find manager in the same department (first Manager or Admin)
        var manager = await _context.Users
            .FirstOrDefaultAsync(u => u.DepartmentId == user.DepartmentId &&
                                     (u.Role == Role.Manager || u.Role == Role.Admin));

        var absenceRequest = new AbsenceRequest
        {
            UserId = userId,
            ManagerId = manager?.Id,
            Date = dto.Date.Date,
            Reason = dto.Reason,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.AbsenceRequests.Add(absenceRequest);
        await _context.SaveChangesAsync();

        // Notify manager if exists
        if (manager != null)
        {
            await _notificationService.CreateNotificationAsync(
                manager.Id,
                "New Absence Request",
                $"{user.FullName} ({user.Department.Name}) has submitted an absence request for {dto.Date:yyyy-MM-dd}. Reason: {dto.Reason}",
                "Info",
                "AbsenceRequest",
                absenceRequest.Id);
        }

        // Reload with includes for mapping
        var savedRequest = await _context.AbsenceRequests
            .Include(a => a.User)
                .ThenInclude(u => u.Department)
            .Include(a => a.Manager)
            .FirstOrDefaultAsync(a => a.Id == absenceRequest.Id);

        return _mapper.Map<AbsenceRequestDto>(savedRequest);
    }

    public async Task<List<AbsenceRequestDto>> GetUserAbsenceRequestsAsync(int userId)
    {
        var requests = await _context.AbsenceRequests
            .Include(a => a.User)
                .ThenInclude(u => u.Department)
            .Include(a => a.Manager)
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<AbsenceRequestDto>>(requests);
    }

    public async Task<List<AbsenceRequestDto>> GetPendingAbsenceRequestsForTeamAsync(int managerId)
    {
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null)
        {
            return new List<AbsenceRequestDto>();
        }

        // Get pending requests from employees in the same department
        var requests = await _context.AbsenceRequests
            .Include(a => a.User)
                .ThenInclude(u => u.Department)
            .Include(a => a.Manager)
            .Where(a => a.Status == RequestStatus.Pending &&
                       a.User.DepartmentId == manager.DepartmentId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<AbsenceRequestDto>>(requests);
    }
}

