namespace PFE.Application.DTOs.Announcement;
public class AnnouncementDto
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public DateTime? PublishAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    public int CreatedById { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
}