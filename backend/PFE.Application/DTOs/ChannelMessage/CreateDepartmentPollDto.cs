namespace PFE.Application.DTOs.ChannelMessage;

public class CreateDepartmentPollDto
{
    public int DepartmentId { get; set; }
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public bool AllowMultipleChoices { get; set; } = false;
    public DateTime? ExpiresAt { get; set; }
    public bool IsPinned { get; set; } = false;
}   