using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.User;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    /// <summary>
    /// Get all users pending approval
    /// </summary>
    /// <returns>List of pending users</returns>
    [HttpGet("pending")]
    public async Task<ActionResult<ApiResponse<List<PendingUserDto>>>> GetPendingUsers()
    {
        var users = await _adminUserService.GetPendingUsersAsync();
        return Ok(ApiResponse<List<PendingUserDto>>.SuccessResponse(users));
    }

    /// <summary>
    /// Approve a user and set their leave balance and optionally role/department
    /// </summary>
    /// <param name="id">User ID to approve</param>
    /// <param name="dto">Approval details (leaveBalance, role?, departmentId?)</param>
    /// <returns>Approved user</returns>
    [HttpPut("{id}/approve")]
    public async Task<ActionResult<ApiResponse<UserDto>>> ApproveUser(int id, [FromBody] ApproveUserDto dto)
    {
        var adminId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _adminUserService.ApproveUserAsync(id, adminId, dto);

        if (result == null)
        {
            return NotFound(ApiResponse<UserDto>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<UserDto>.SuccessResponse(result, "User approved successfully"));
    }

    /// <summary>
    /// Change a user's role (without re-approving)
    /// </summary>
    /// <param name="id">User ID</param>
    /// <param name="dto">New role</param>
    /// <returns>Updated user</returns>
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
}
