using PFE.Domain.Enums;

namespace PFE.Application.DTOs.GeneralRequest;

public class CreateGeneralRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public RequestCategory Category { get; set; }

    public DateTime? AuthorizedDate { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public int? TotalMinutes { get; set; }

    public string? Motif { get; set; }
    public string? RequestType { get; set; }
    public string? RequestText { get; set; }
    public string? DocumentType { get; set; }
    public string? Subject { get; set; }

    public int? TotalRecoveryMinutes { get; set; }
    public List<RecoverySlotDto>? RecoverySlots { get; set; }
    public string? RecoveryPermutationType { get; set; }
    public string? RecoveryNature { get; set; }
    public int? RequiredRecoveryMinutes { get; set; }
}
