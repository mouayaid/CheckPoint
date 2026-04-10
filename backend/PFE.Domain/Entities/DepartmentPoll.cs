namespace PFE.Domain.Entities;

public class DepartmentPoll
{
    public int Id { get; set; }

    public int MessageId { get; set; }
    public DepartmentChannelMessage Message { get; set; } = null!;

    public string Question { get; set; } = string.Empty;

    public bool AllowMultipleChoices { get; set; } = false;

    public bool IsClosed { get; set; } = false;

    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<DepartmentPollOption> Options { get; set; } = new List<DepartmentPollOption>();
    public ICollection<DepartmentPollVote> Votes { get; set; } = new List<DepartmentPollVote>();
}