using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class GeneralRequest
{
    public int Id { get; set; }
    public int? AssignedToUserId { get; set; }
    public User? AssignedTo { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public RequestCategory Category { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Pending;

    public string? AdminComment { get; set; }

    public DateTime? ResolvedAt { get; set; }


    public User? AssignedToUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

