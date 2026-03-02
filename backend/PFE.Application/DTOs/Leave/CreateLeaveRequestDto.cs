using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Leave;

public class CreateLeaveRequestDto
{
    public LeaveType Type { get; set; }        // ✅ enum, not string
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Reason { get; set; } = string.Empty;
}

