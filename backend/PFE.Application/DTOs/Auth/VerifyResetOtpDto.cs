namespace PFE.Application.DTOs.Auth;

using System.ComponentModel.DataAnnotations;

public class VerifyResetOtpDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^\d{6}$")]
    public string OtpCode { get; set; } = string.Empty;
}
