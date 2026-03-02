using PFE.Domain.Enums;

namespace PFE.Application.DTOs.GeneralRequest;

public class AssignGeneralRequestDto
{
    public int? AssignedToUserId { get; set; }
    public RequestStatus Status { get; set; }
    public string? Comment { get; set; }
}

