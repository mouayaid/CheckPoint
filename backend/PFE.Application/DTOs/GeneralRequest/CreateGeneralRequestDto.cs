using PFE.Domain.Enums;

namespace PFE.Application.DTOs.GeneralRequest;

public class CreateGeneralRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public RequestCategory Category { get; set; }
}

