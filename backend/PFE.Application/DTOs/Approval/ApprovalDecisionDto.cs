namespace PFE.Application.DTOs.Approval;

public class ApprovalDecisionDto
{
    public string Decision { get; set; } = string.Empty; // "approve" or "reject"
    public string? Comment { get; set; }
}

