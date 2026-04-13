namespace PFE.Application.DTOs.ChannelMessage;

public class MyDepartmentChannelDto
{
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;

    public int UnreadCount { get; set; }

    public string? LastMessagePreview { get; set; }

    public DateTime? LastActivityAt { get; set; }
}