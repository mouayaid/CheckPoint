using PFE.Domain.Enums;

namespace PFE.Application.DTOs.User;

public class UserDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public Role Role { get; set; }
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public int? LeaveBalance { get; set; }
    public decimal? YearlySalary { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

