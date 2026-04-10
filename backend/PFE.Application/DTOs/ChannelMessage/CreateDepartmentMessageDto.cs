namespace PFE.Application.DTOs.ChannelMessage;

public class CreateDepartmentMessageDto
{
    public int DepartmentId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsPinned { get; set; } = false;
}