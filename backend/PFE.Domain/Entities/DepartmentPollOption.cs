namespace PFE.Domain.Entities;

public class DepartmentPollOption
{
    public int Id { get; set; }

    public int PollId { get; set; }
    public DepartmentPoll Poll { get; set; } = null!;

    public string Text { get; set; } = string.Empty;

    public ICollection<DepartmentPollVote> Votes { get; set; } = new List<DepartmentPollVote>();
}