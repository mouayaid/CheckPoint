namespace PFE.Domain.Entities;

public class InternalRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Category { get; set; } = string.Empty; // HR, IT, Admin
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending"; // Pending, InProgress, Resolved, Rejected
    public string? AdminComment { get; set; }
    public int? AssignedToId { get; set; }
    public User? AssignedTo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}

