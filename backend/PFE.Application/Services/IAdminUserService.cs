using PFE.Application.DTOs.User;

namespace PFE.Application.Services;

public interface IAdminUserService
{
    Task<List<PendingUserDto>> GetPendingUsersAsync();
    Task<UserDto?> ApproveUserAsync(int userId, int reviewerId, ApproveUserDto dto);
    Task<UserDto?> ChangeUserRoleAsync(int userId, ChangeUserRoleDto dto);
    Task<UserDto?> RejectUserAsync(int userId, int reviewerId, RejectUserDto dto);
}