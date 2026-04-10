namespace PFE.Domain.Entities;

public class DepartmentPollVote
{
    public int Id { get; set; }

    public int PollId { get; set; }
    public DepartmentPoll Poll { get; set; } = null!;

    public int PollOptionId { get; set; }
    public DepartmentPollOption PollOption { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime VotedAt { get; set; } = DateTime.UtcNow;
}