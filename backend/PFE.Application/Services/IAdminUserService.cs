using PFE.Application.DTOs.User;

namespace PFE.Application.Services;

public interface IAdminUserService
{
    Task<List<PendingUserDto>> GetPendingUsersAsync();
    Task<List<UserDto>> GetAllUsersAsync(string? search, string? role, bool? isActive);
    Task<UserDto?> GetUserByIdAsync(int userId);
    Task<UserDto?> ApproveUserAsync(int userId, int reviewerId, ApproveUserDto dto);
    Task<UserDto?> ChangeUserRoleAsync(int userId, ChangeUserRoleDto dto);
    Task<UserDto?> RejectUserAsync(int userId, int reviewerId, RejectUserDto dto);
    Task<UserDto?> UpdateUserAsync(int userId, UpdateUserDto dto);
    Task<bool> DeleteUserAsync(int userId);
}