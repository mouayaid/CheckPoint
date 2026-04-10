namespace PFE.Application.DTOs.Announcement;
public class UpdateAnnouncementDto
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime? PublishAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}