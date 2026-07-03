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
    public DateTime? AuthorizedDate { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public int? TotalMinutes { get; set; }
    public string? Motif { get; set; }

    public int? TotalRecoveryMinutes { get; set; }
    public string? RecoverySlotsJson { get; set; }
    public string? RecoveryPermutationType { get; set; }
    public string? RecoveryNature { get; set; }
    public int? RequiredRecoveryMinutes { get; set; }
    public string? RequestType { get; set; }
    public string? RequestText { get; set; }
    public string? DocumentType { get; set; }
    public string? Subject { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Pending;

    public string? AdminComment { get; set; }

    public DateTime? ResolvedAt { get; set; }


    public User? AssignedToUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

