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
            .Where(u => !u.IsActive && u.RejectedAt == null)
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

    public async Task<List<UserDto>> GetAllUsersAsync(string? search, string? role, bool? isActive)
    {
        var query = _context.Users
            .Include(u => u.Department)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(lower) ||
                u.Email.ToLower().Contains(lower) ||
                (u.Department != null && u.Department.Name.ToLower().Contains(lower)));
        }

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<Role>(role, true, out var parsedRole))
        {
            query = query.Where(u => u.Role == parsedRole);
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        var users = await query.OrderBy(u => u.FullName).ToListAsync();
        return _mapper.Map<List<UserDto>>(users);
    }

    public async Task<UserDto?> GetUserByIdAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return user == null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> ApproveUserAsync(int userId, int reviewerId, ApproveUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        user.IsActive = true;
        user.LeaveBalance = dto.LeaveBalance;
        user.YearlySalary = dto.YearlySalary;
        user.ApprovedAt = DateTime.UtcNow;
        user.ApprovedByUserId = reviewerId;

        if (dto.Role.HasValue)
        {
            user.Role = dto.Role.Value;
        }

        if (dto.DepartmentId.HasValue)
        {
            user.DepartmentId = dto.DepartmentId.Value;
        }

        await _context.SaveChangesAsync();

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

    public async Task<UserDto?> RejectUserAsync(int userId, int reviewerId, RejectUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        if (user.IsActive)
        {
            throw new InvalidOperationException("Approved users cannot be rejected from the pending approvals screen.");
        }

        if (user.RejectedAt != null)
        {
            return _mapper.Map<UserDto>(user);
        }

        user.IsActive = false;
        user.RejectedAt = DateTime.UtcNow;
        user.RejectedById = reviewerId;

        await _context.SaveChangesAsync();

        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> UpdateUserAsync(int userId, UpdateUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(dto.FullName))
            user.FullName = dto.FullName.Trim();

        user.Role = dto.Role;
        user.DepartmentId = dto.DepartmentId;
        user.LeaveBalance = dto.LeaveBalance;

        await _context.SaveChangesAsync();

        var updated = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return _mapper.Map<UserDto>(updated);
    }

    public async Task<bool> DeleteUserAsync(int userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return false;
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return true;
    }
}