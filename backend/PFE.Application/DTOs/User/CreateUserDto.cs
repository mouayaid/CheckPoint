namespace PFE.Application.DTOs.User;

public class CreateUserDto
{
    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public int RoleId { get; set; } = 1; // default Employee

    public int DepartmentId { get; set; }

    public int LeaveBalance { get; set; } = 0;
}