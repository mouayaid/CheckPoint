using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace PFE.Application.DTOs.Profile;

public sealed class UpdateMyProfileDto
{
    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    public IFormFile? ProfileImage { get; set; }
}
