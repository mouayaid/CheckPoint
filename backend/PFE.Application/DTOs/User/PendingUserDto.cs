using PFE.Domain.Enums;

namespace PFE.Application.DTOs.User;

public class PendingUserDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DepartmentName { get; set; }
    public DateTime CreatedAt { get; set; }
    public Role Role { get; set; }
    public bool IsActive { get; set; }
}
