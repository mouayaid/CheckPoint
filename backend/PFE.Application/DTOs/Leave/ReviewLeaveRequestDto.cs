using PFE.Domain.Enums;

namespace PFE.Application.DTOs.Leave;

public class ReviewLeaveRequestDto
{
    public RequestStatus Status { get; set; }
    public string? ManagerComment { get; set; }
}

