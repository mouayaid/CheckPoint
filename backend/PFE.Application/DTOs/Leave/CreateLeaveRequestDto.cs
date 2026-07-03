using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Leave;

public class CreateLeaveRequestDto
{
    public LeaveType Type { get; set; }
    public decimal? RequestedDays { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    public HalfDayPeriod? DayPeriod { get; set; }
    public TimeSpan? FromTime { get; set; }
    public TimeSpan? ToTime { get; set; }
}
