namespace PFE.Application.DTOs.GeneralRequest;

public class RecoverySlotDto
{
    public DateTime? Date { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public int Minutes { get; set; }
}
