using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.User;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class AdminUserService : IAdminUserService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public AdminUserService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<List<PendingUserDto>> GetPendingUsersAsync()
    {
        var users = await _context.Users
            .Include(u => u.Department)
            .Where(u => !u.IsActive)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync();

        return users.Select(u => new PendingUserDto
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            DepartmentName = u.Department?.Name,
            CreatedAt = u.CreatedAt,
            Role = u.Role,
            IsActive = u.IsActive
        }).ToList();
    }

    public async Task<UserDto?> ApproveUserAsync(int userId, int adminId, ApproveUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        // Activate user
        user.IsActive = true;
        user.LeaveBalance = dto.LeaveBalance;
        user.ApprovedAt = DateTime.UtcNow;
        user.ApprovedByUserId = adminId;

        // Update role if provided
        if (dto.Role.HasValue)
        {
            user.Role = dto.Role.Value;
        }

        // Update department if provided
        if (dto.DepartmentId.HasValue)
        {
            user.DepartmentId = dto.DepartmentId.Value;
        }

        await _context.SaveChangesAsync();

        // Reload with department to ensure mapping works
        var updatedUser = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return _mapper.Map<UserDto>(updatedUser);
    }

    public async Task<UserDto?> ChangeUserRoleAsync(int userId, ChangeUserRoleDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        user.Role = dto.Role;
        await _context.SaveChangesAsync();

        return _mapper.Map<UserDto>(user);
    }
}
