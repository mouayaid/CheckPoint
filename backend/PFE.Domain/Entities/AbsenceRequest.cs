using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class AbsenceRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime Date { get; set; }
    public string Reason { get; set; } = string.Empty;
    public RequestStatus Status { get; set; } = RequestStatus.Pending;
    public int? ManagerId { get; set; }
    public User? Manager { get; set; }

    public string? ManagerComment { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

