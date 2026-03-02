namespace PFE.Application.DTOs.Auth;
using PFE.Application.DTOs.User;

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; } = null!;
}

