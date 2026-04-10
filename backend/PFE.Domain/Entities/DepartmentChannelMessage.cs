namespace PFE.Domain.Entities;

public class DepartmentChannelMessage
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public int SenderId { get; set; }
    public User Sender { get; set; } = null!;

    public string Content { get; set; } = string.Empty;

    // Text, Poll, System
    public string MessageType { get; set; } = "Text";

    public bool IsPinned { get; set; } = false;
    public string? Title { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DepartmentPoll? Poll { get; set; }
}