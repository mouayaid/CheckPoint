using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class LeaveRequest
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public LeaveType Type { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Pending;

    public string Reason { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? ManagerComment { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public int? AssignedManagerId { get; set; }
    public User? AssignedManager { get; set; }

    public int? ReviewedById { get; set; }
    public User? ReviewedBy { get; set; }
}