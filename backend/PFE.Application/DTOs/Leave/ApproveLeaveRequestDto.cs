namespace PFE.Application.DTOs.Leave;

public class ApproveLeaveRequestDto
{
    public string? Comment { get; set; }
    public bool DeductFromLeaveBalance { get; set; }
}
