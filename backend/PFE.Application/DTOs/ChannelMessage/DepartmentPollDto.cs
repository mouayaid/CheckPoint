namespace PFE.Application.DTOs.ChannelMessage;

public class DepartmentPollDto
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public bool AllowMultipleChoices { get; set; }
    public bool IsClosed { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool HasVoted { get; set; }
    public int? SelectedOptionId { get; set; }
    public List<DepartmentPollOptionDto> Options { get; set; } = new();
}