namespace PFE.Application.DTOs.Auth;

public class VerifyResetOtpDto
{
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
}