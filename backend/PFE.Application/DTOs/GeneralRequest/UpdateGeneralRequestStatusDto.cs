using PFE.Domain.Enums;

namespace PFE.Application.DTOs.GeneralRequest;

public class UpdateGeneralRequestStatusDto
{
    public RequestStatus Status { get; set; }
    public string? Comment { get; set; }
}

