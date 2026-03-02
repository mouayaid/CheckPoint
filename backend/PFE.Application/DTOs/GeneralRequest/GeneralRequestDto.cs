using PFE.Domain.Enums;

namespace PFE.Application.DTOs.GeneralRequest;

public class GeneralRequestDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public RequestCategory Category { get; set; }
    public RequestStatus Status { get; set; }
    public string? AssignedToUserName { get; set; }
    public DateTime CreatedAt { get; set; }
}

