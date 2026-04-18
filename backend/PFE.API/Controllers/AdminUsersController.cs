using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.User;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin,HR")]
public class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    // GET /api/admin/users/pending
    [HttpGet("pending")]
    public async Task<ActionResult<ApiResponse<List<PendingUserDto>>>> GetPendingUsers()
    {
        var users = await _adminUserService.GetPendingUsersAsync();
        return Ok(ApiResponse<List<PendingUserDto>>.SuccessResponse(users));
    }

    // GET /api/admin/users?search=...&role=...&isActive=true|false
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAllUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] bool? isActive)
    {
        var users = await _adminUserService.GetAllUsersAsync(search, role, isActive);
        return Ok(ApiResponse<List<UserDto>>.SuccessResponse(users));
    }

    // GET /api/admin/users/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetUserById(int id)
    {
        var user = await _adminUserService.GetUserByIdAsync(id);
        if (user == null)
            return NotFound(ApiResponse<UserDto>.ErrorResponse("User not found"));

        return Ok(ApiResponse<UserDto>.SuccessResponse(user));
    }

    // PUT /api/admin/users/{id}/approve
    [HttpPut("{id}/approve")]
    public async Task<ActionResult<ApiResponse<UserDto>>> ApproveUser(int id, [FromBody] ApproveUserDto dto)
    {
        var reviewerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _adminUserService.ApproveUserAsync(id, reviewerId, dto);

        if (result == null)
        {
            return NotFound(ApiResponse<UserDto>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<UserDto>.SuccessResponse(result, "User approved successfully"));
    }

    // PUT /api/admin/users/{id}/reject
    [HttpPut("{id}/reject")]
    public async Task<ActionResult<ApiResponse<UserDto>>> RejectUser(int id, [FromBody] RejectUserDto dto)
    {
        var reviewerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _adminUserService.RejectUserAsync(id, reviewerId, dto);

        if (result == null)
        {
            return NotFound(ApiResponse<UserDto>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<UserDto>.SuccessResponse(result, "User rejected successfully"));
    }

    // PUT /api/admin/users/{id}/role
    [HttpPut("{id}/role")]
    public async Task<ActionResult<ApiResponse<UserDto>>> ChangeUserRole(int id, [FromBody] ChangeUserRoleDto dto)
    {
        var result = await _adminUserService.ChangeUserRoleAsync(id, dto);

        if (result == null)
        {
            return NotFound(ApiResponse<UserDto>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<UserDto>.SuccessResponse(result, "User role updated successfully"));
    }

    // PUT /api/admin/users/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var result = await _adminUserService.UpdateUserAsync(id, dto);

        if (result == null)
        {
            return NotFound(ApiResponse<UserDto>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<UserDto>.SuccessResponse(result, "User updated successfully"));
    }

    // DELETE /api/admin/users/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteUser(int id)
    {
        var deleted = await _adminUserService.DeleteUserAsync(id);

        if (!deleted)
        {
            return NotFound(ApiResponse<object>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<object>.SuccessResponse(null, "User deleted successfully"));
    }
}