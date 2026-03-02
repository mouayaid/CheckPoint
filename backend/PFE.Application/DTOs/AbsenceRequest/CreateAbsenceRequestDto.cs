namespace PFE.Application.DTOs.AbsenceRequest;

public class CreateAbsenceRequestDto
{
    public DateTime Date { get; set; }
    public string Reason { get; set; } = string.Empty;
}

