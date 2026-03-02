namespace PFE.Application.DTOs.AbsenceRequest;

public class UpdateAbsenceRequestDto
{
    public DateTime Date { get; set; }
    public string Reason { get; set; } = string.Empty;
}

