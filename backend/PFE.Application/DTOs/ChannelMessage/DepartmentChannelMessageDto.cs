namespace PFE.Application.DTOs.ChannelMessage;

public class DepartmentChannelMessageDto
{
    public int Id { get; set; }
    public int DepartmentId { get; set; }
    public int SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DepartmentPollDto? Poll { get; set; }
}