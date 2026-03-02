using PFE.Domain.Enums;

namespace PFE.Application.DTOs.User;

public class UpdateUserDto
{
    public string FullName { get; set; } = string.Empty;
    public Role Role { get; set; }
    public int DepartmentId { get; set; }
    public int LeaveBalance { get; set; }
}

