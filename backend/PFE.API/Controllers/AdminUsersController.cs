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

    [HttpGet("pending")]
    public async Task<ActionResult<ApiResponse<List<PendingUserDto>>>> GetPendingUsers()
    {
        var users = await _adminUserService.GetPendingUsersAsync();
        return Ok(ApiResponse<List<PendingUserDto>>.SuccessResponse(users));
    }

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