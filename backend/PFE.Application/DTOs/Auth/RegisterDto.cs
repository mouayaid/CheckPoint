using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Auth;

public class RegisterDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; } = Role.Employee;
    public int DepartmentId { get; set; }
    public int LeaveBalance { get; set; } = 0;
}
