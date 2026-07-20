using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.Auth;
using PFE.Application.Services;
using System.Security.Claims;
using Microsoft.AspNetCore.RateLimiting;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("PasswordRecoveryPolicy")]
    public async Task<ActionResult<ApiResponse<object>>> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        await _authService.ForgotPasswordAsync(dto.Email);

        return Ok(ApiResponse<object>.SuccessResponse(null, "If an account with this email exists, a reset code has been sent."));
    }


    [HttpPost("verify-reset-otp")]
    [EnableRateLimiting("AuthenticationPolicy")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyResetOtp([FromBody] VerifyResetOtpDto dto)
    {
        var result = await _authService.VerifyResetOtpAsync(dto.Email, dto.OtpCode);

        if (!result)
        {
            return BadRequest(ApiResponse<object>.ErrorResponse("Invalid or expired OTP"));
        }

        return Ok(ApiResponse<object>.SuccessResponse(null, "OTP verified successfully"));
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting("PasswordRecoveryPolicy")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        var result = await _authService.ResetPasswordAsync(dto.Email, dto.OtpCode, dto.NewPassword);

        if (!result)
        {
            return BadRequest(ApiResponse<object>.ErrorResponse("Invalid OTP or email"));
        }

        return Ok(ApiResponse<object>.SuccessResponse(null, "Password reset successfully"));
    }

    [HttpPost("login")]
    [EnableRateLimiting("AuthenticationPolicy")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Login([FromBody] LoginDto loginDto)
    {
        try
        {
            var result = await _authService.LoginAsync(loginDto);

            if (result == null)
            {
                return BadRequest(ApiResponse<AuthResponseDto>.ErrorResponse("Invalid email or password"));
            }

            if (result.User == null || string.IsNullOrEmpty(result.Token))
            {
                return StatusCode(403, ApiResponse<AuthResponseDto>.ErrorResponse("Your account is not active. It may be pending approval or disabled."));
            }

            return Ok(ApiResponse<AuthResponseDto>.SuccessResponse(result, "Login successful"));
        }
        catch (BadRequestException ex)
        {
            _logger.LogWarning(ex, "Invalid login request.");
            return BadRequest(ApiResponse<AuthResponseDto>.ErrorResponse("Invalid request."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected login failure.");
            return StatusCode(500, ApiResponse<AuthResponseDto>.ErrorResponse(
                "An unexpected error occurred."
            ));
        }
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Refresh([FromBody] RefreshTokenDto dto)
    {
        var result = await _authService.RefreshTokenAsync(dto.RefreshToken);

        if (result == null)
        {
            return Unauthorized(ApiResponse<AuthResponseDto>.ErrorResponse("Invalid refresh token"));
        }

        return Ok(ApiResponse<AuthResponseDto>.SuccessResponse(result, "Token refreshed"));
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
            Token = string.Empty,
            RefreshToken = string.Empty
        };

        return Ok(ApiResponse<AuthResponseDto>.SuccessResponse(response));
    }
}

