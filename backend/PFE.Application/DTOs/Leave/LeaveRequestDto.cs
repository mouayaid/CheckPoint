using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Leave;

public class LeaveRequestDto
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;

    public int? AssignedManagerId { get; set; }
    public string? AssignedManagerName { get; set; }

    public int? ReviewedById { get; set; }
    public string? ReviewedByName { get; set; }

    public LeaveType Type { get; set; }
    public string TypeLabel => Type.ToString();

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public string Reason { get; set; } = string.Empty;

    public RequestStatus Status { get; set; }
    public string StatusLabel => Status.ToString();

    public string? ManagerComment { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
}