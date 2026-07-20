namespace PFE.Application.DTOs.Auth;

using System.ComponentModel.DataAnnotations;

public class RefreshTokenDto
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}
