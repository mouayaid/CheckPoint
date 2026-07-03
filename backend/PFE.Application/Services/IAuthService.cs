using PFE.Application.DTOs.User;
using PFE.Application.DTOs.Auth;

namespace PFE.Application.Services;

public interface IAuthService
{
    Task<AuthResponseDto?> LoginAsync(LoginDto loginDto);
    Task<AuthResponseDto?> RegisterAsync(RegisterDto registerDto);
    Task<UserDto?> GetUserByIdAsync(int userId);
    Task<AuthResponseDto?> RefreshTokenAsync(string refreshToken);

    Task<bool> ForgotPasswordAsync(string email);
    Task<bool> VerifyResetOtpAsync(string email, string otpCode);
    Task<bool> ResetPasswordAsync(string email, string otpCode, string newPassword);
}

