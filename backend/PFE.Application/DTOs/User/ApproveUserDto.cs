namespace PFE.Application.DTOs.User;

public class ApproveUserDto
{
    public int LeaveBalance { get; set; }
    public decimal YearlySalary { get; set; }

    public int? RoleId { get; set; }

    public int? DepartmentId { get; set; }
}