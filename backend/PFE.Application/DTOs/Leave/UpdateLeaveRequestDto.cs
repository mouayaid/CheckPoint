using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Leave;

public class UpdateLeaveRequestDto
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public LeaveType Type { get; set; }
    public decimal? RequestedDays { get; set; }
    public HalfDayPeriod? DayPeriod { get; set; }
    public TimeSpan? FromTime { get; set; }
    public TimeSpan? ToTime { get; set; }
}
