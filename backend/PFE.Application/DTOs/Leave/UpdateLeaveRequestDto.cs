using PFE.Domain.Enums;

namespace PFE.Application.DTOs.LeaveRequest;

public class UpdateLeaveRequestDto
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public LeaveType Type { get; set; }
}

