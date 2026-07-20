namespace PFE.Application.DTOs.ChannelMessage;

public class DepartmentPollVotersDto
{
    public int PollId { get; set; }
    public List<DepartmentPollOptionVotersDto> Options { get; set; } = new();
}
