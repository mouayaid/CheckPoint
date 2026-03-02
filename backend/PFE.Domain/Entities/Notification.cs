namespace PFE.Domain.Entities;

public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "Info"; // Info, Warning, Success, Error
    public string? RelatedEntityType { get; set; } // e.g., "Event", "GeneralRequest", "LeaveRequest"
    public int? RelatedEntityId { get; set; } // ID of the related entity
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
