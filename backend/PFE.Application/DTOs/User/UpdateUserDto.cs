using PFE.Domain.Enums;

namespace PFE.Application.DTOs.User;

public class UpdateUserDto
{
    public string FullName { get; set; } = string.Empty;
    public int RoleId { get; set; }
    public int? DepartmentId { get; set; }
    public int LeaveBalance { get; set; }
}

