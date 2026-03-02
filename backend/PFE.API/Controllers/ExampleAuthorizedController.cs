using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using System.Security.Claims;

namespace PFE.API.Controllers;

/// <summary>
/// Example controller demonstrating various authorization patterns
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ExampleAuthorizedController : ControllerBase
{
    /// <summary>
    /// Example 1: Requires any authenticated user
    /// </summary>
    [Authorize]
    [HttpGet("authenticated-only")]
    public IActionResult AuthenticatedOnly()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var email = User.FindFirst(ClaimTypes.Email)!.Value;
        
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "You are authenticated",
            UserId = userId,
            Email = email
        }));
    }

    /// <summary>
    /// Example 2: Requires specific role (Employee)
    /// </summary>
    [Authorize(Roles = "Employee")]
    [HttpGet("employee-only")]
    public IActionResult EmployeeOnly()
    {
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "This endpoint is for Employees only"
        }));
    }

    /// <summary>
    /// Example 3: Requires Manager role
    /// </summary>
    [Authorize(Roles = "Manager")]
    [HttpGet("manager-only")]
    public IActionResult ManagerOnly()
    {
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "This endpoint is for Managers only"
        }));
    }

    /// <summary>
    /// Example 4: Requires Admin role
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpGet("admin-only")]
    public IActionResult AdminOnly()
    {
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "This endpoint is for Admins only"
        }));
    }

    /// <summary>
    /// Example 5: Requires Manager OR Admin (multiple roles)
    /// </summary>
    [Authorize(Roles = "Manager,Admin")]
    [HttpGet("manager-or-admin")]
    public IActionResult ManagerOrAdmin()
    {
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "This endpoint is for Managers or Admins"
        }));
    }

    /// <summary>
    /// Example 6: Using authorization policy (defined in Program.cs)
    /// </summary>
    [Authorize(Policy = "ManagerOrAdmin")]
    [HttpGet("policy-based")]
    public IActionResult PolicyBased()
    {
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "This uses a policy defined in Program.cs"
        }));
    }

    /// <summary>
    /// Example 7: Get current user info from JWT token
    /// </summary>
    [Authorize]
    [HttpGet("current-user")]
    public IActionResult GetCurrentUser()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var email = User.FindFirst(ClaimTypes.Email)!.Value;
        var role = User.FindFirst(ClaimTypes.Role)!.Value;

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            UserId = userId,
            Email = email,
            Role = role
        }));
    }

    /// <summary>
    /// Example 8: Public endpoint (no authorization)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("public")]
    public IActionResult Public()
    {
        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            Message = "This is a public endpoint"
        }));
    }
}

