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
        try
        {
            var users = await _context.Users
                .Where(u => !u.IsActive)
                .Select(u => new PendingUserDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Email = u.Email,
                    RoleId = u.RoleId,
                    RoleName = u.Role != null ? u.Role.Name : null,
                    DepartmentName = u.Department != null ? u.Department.Name : null,
                    CreatedAt = u.CreatedAt,
                    IsActive = u.IsActive
                })
                .ToListAsync();

            return users;
        }
        catch (Exception ex)
        {
            Console.WriteLine("❌ ERROR IN GetPendingUsersAsync:");
            Console.WriteLine(ex.Message);
            Console.WriteLine(ex.StackTrace);
            throw; // keep throwing so API returns 500 with real message
        }
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

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(u => u.Role.Name == role);
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

        if (dto.RoleId.HasValue)
        {
            user.RoleId = dto.RoleId.Value;
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

        user.RoleId = dto.RoleId;
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

        user.RoleId = dto.RoleId;
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