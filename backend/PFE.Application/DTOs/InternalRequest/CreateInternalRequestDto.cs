namespace PFE.Application.DTOs.InternalRequest;

public class CreateInternalRequestDto
{
    public string Category { get; set; } = string.Empty; // HR, IT, Admin
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

