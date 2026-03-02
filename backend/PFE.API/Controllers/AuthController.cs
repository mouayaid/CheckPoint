using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Auth;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Login([FromBody] LoginDto loginDto)
    {
        var result = await _authService.LoginAsync(loginDto);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<AuthResponseDto>.ErrorResponse("Invalid email or password"));
        }

        // Check if user account is inactive (pending approval)
        if (result.User == null || string.IsNullOrEmpty(result.Token))
        {
            return StatusCode(403, ApiResponse<AuthResponseDto>.ErrorResponse("Your account is pending admin approval."));
        }

        return Ok(ApiResponse<AuthResponseDto>.SuccessResponse(result, "Login successful"));
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Register([FromBody] RegisterDto registerDto)
    {
        var result = await _authService.RegisterAsync(registerDto);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<AuthResponseDto>.ErrorResponse("Email already exists"));
        }

        return Ok(ApiResponse<AuthResponseDto>.SuccessResponse(result, "Account created. Waiting admin approval."));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> GetCurrentUser()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(ApiResponse<AuthResponseDto>.ErrorResponse("Invalid token"));
        }

        var user = await _authService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<AuthResponseDto>.ErrorResponse("User not found"));
        }

        var response = new AuthResponseDto
        {
            User = user,
            Token = string.Empty // Token not needed here
        };

        return Ok(ApiResponse<AuthResponseDto>.SuccessResponse(response));
    }
}

