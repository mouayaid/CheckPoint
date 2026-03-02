using PFE.Application.DTOs.User;
using PFE.Application.DTOs.Auth;

namespace PFE.Application.Services;

public interface IAuthService
{
    Task<AuthResponseDto?> LoginAsync(LoginDto loginDto);
    Task<AuthResponseDto?> RegisterAsync(RegisterDto registerDto);
    Task<UserDto?> GetUserByIdAsync(int userId);
}

