namespace PFE.Application.DTOs.ChannelMessage;

public class DepartmentPollOptionVotersDto
{
    public int OptionId { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public List<DepartmentPollVoterDto> Voters { get; set; } = new();
}
