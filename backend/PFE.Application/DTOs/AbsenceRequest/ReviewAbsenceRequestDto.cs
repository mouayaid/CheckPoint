using PFE.Domain.Enums;

namespace PFE.Application.DTOs.AbsenceRequest;

public class ReviewAbsenceRequestDto
{
    public RequestStatus Status { get; set; }
    public string? Comment { get; set; }
}

