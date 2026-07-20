using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.User;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public class AdminUserService : IAdminUserService
{
    private static readonly int[] AllowedRoleIds = { 1, 2, 3 };
    private const int EmployeeRoleId = 1;
    private const int ManagerRoleId = 2;
    private const int AdminRoleId = 3;

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
                .Where(u => !u.IsActive && u.ApprovedAt == null && u.RejectedAt == null)
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
            .Include(u => u.Role)
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
            query = query.Where(u => u.Role.Name == role && AllowedRoleIds.Contains(u.RoleId));
        }

        if (isActive == true)
        {
            query = query.Where(u =>
                u.IsActive &&
                u.RejectedAt == null);
        }
        else if (isActive == false)
        {
            query = query.Where(u =>
                !u.IsActive &&
                u.ApprovedAt != null &&
                u.RejectedAt == null);
        }
        else
        {
            query = query.Where(u =>
                (u.IsActive || u.ApprovedAt != null) &&
                u.RejectedAt == null);
        }

        var users = await query.OrderBy(u => u.FullName).ToListAsync();
        return _mapper.Map<List<UserDto>>(users);
    }

    public async Task<UserDto?> GetUserByIdAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return user == null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> ApproveUserAsync(int userId, int reviewerId, ApproveUserDto dto)
    {
        var reviewerIsAdmin = await _context.Users
            .AnyAsync(u => u.Id == reviewerId && u.Role.Name == "Admin");

        if (!reviewerIsAdmin)
        {
            throw new ForbiddenException("Only admins can approve pending users.");
        }

        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        if (user.IsActive || user.ApprovedAt != null || user.RejectedAt != null)
        {
            throw new BadRequestException("Only pending users can be approved.");
        }

        var roleId = dto.RoleId ?? user.RoleId;
        EnsureAllowedRole(roleId);

        if (roleId != AdminRoleId)
        {
            if (!dto.DepartmentId.HasValue || dto.DepartmentId.Value <= 0)
            {
                throw new BadRequestException("Department is required before approving the user.");
            }

            var departmentExists = await _context.Departments
                .AnyAsync(d => d.Id == dto.DepartmentId.Value);

            if (!departmentExists)
            {
                throw new NotFoundException("Department not found.");
            }
        }

        user.IsActive = true;
        user.LeaveBalance = NormalizeLeaveBalance(roleId, dto.LeaveBalance);
        if (roleId == AdminRoleId)
        {
            user.YearlySalary = null;
        }
        else
        {
            if (!dto.YearlySalary.HasValue || dto.YearlySalary.Value <= 0)
            {
                throw new BadRequestException(
                    "Yearly salary is required and must be greater than zero."
                );
            }

            user.YearlySalary = dto.YearlySalary.Value;
        }
        user.ApprovedAt = DateTime.UtcNow;
        user.ApprovedByUserId = reviewerId;
        user.RoleId = roleId;
        user.DepartmentId = roleId == AdminRoleId ? null : dto.DepartmentId!.Value;

        await _context.SaveChangesAsync();

        var updatedUser = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return _mapper.Map<UserDto>(updatedUser);
    }

    public async Task<UserDto?> ChangeUserRoleAsync(int userId, ChangeUserRoleDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        EnsureAllowedRole(dto.RoleId);
        user.RoleId = dto.RoleId;
        if (dto.RoleId == AdminRoleId)
        {
            user.DepartmentId = null;
            user.LeaveBalance = null;
        }
        else if (!user.DepartmentId.HasValue || user.DepartmentId.Value <= 0)
        {
            throw new InvalidOperationException("Department is required for Employee and Manager users.");
        }

        await _context.SaveChangesAsync();

        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> RejectUserAsync(int userId, int reviewerId, RejectUserDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        if (user.IsActive || user.ApprovedAt != null)
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
        user.RejectionReason = dto.Reason;

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

        EnsureAllowedRole(dto.RoleId);
        user.RoleId = dto.RoleId;
        user.DepartmentId = NormalizeDepartmentId(dto.RoleId, dto.DepartmentId);
        user.LeaveBalance = NormalizeLeaveBalance(dto.RoleId, dto.LeaveBalance);

        await _context.SaveChangesAsync();

        var updated = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return _mapper.Map<UserDto>(updated);
    }

    public async Task<bool> DeactivateUserAsync(int userId, int currentUserId)
    {
        if (userId == currentUserId)
        {
            throw new InvalidOperationException("You cannot deactivate your own account.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return false;
        }

        if (user.ApprovedAt == null || user.RejectedAt != null)
        {
            if (!user.IsActive || user.RejectedAt != null)
            {
                throw new InvalidOperationException("Only approved users can be deactivated.");
            }

            user.ApprovedAt = DateTime.UtcNow;
        }

        user.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ReactivateUserAsync(int userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return false;
        }

        if (user.ApprovedAt == null || user.RejectedAt != null)
        {
            throw new InvalidOperationException("Only previously approved users can be reactivated.");
        }

        user.IsActive = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public Task<bool> DeleteUserAsync(int userId, int currentUserId)
    {
        return DeactivateUserAsync(userId, currentUserId);
    }

    private static void EnsureAllowedRole(int roleId)
    {
        if (!AllowedRoleIds.Contains(roleId))
        {
            throw new InvalidOperationException("Role must be Employee, Manager, or Admin.");
        }
    }

    private static int? NormalizeDepartmentId(int roleId, int? departmentId)
    {
        if (roleId == AdminRoleId)
        {
            return null;
        }

        if (roleId is EmployeeRoleId or ManagerRoleId)
        {
            if (!departmentId.HasValue || departmentId.Value <= 0)
            {
                throw new InvalidOperationException("Department is required for Employee and Manager users.");
            }

            return departmentId.Value;
        }

        EnsureAllowedRole(roleId);
        return departmentId;
    }

    private static decimal? NormalizeLeaveBalance(int roleId, decimal? leaveBalance)
    {
        EnsureAllowedRole(roleId);

        if (roleId == AdminRoleId)
        {
            return null;
        }

        if (!leaveBalance.HasValue || leaveBalance.Value < 0)
        {
            throw new BadRequestException(
                "Leave balance is required and must be zero or greater."
            );
        }

        return leaveBalance.Value;
    }
}
