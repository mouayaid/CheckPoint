using PFE.Domain.Entities;
public class Announcement
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public DateTime? PublishAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    public bool IsActive { get; set; } = true;

    public int CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;
}