namespace PFE.Application.DTOs.Seat;

public class SeatMapResponseDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public int PositionX { get; set; }
    public int PositionY { get; set; }
    public int OfficeTableId { get; set; }
    public bool IsReserved { get; set; }
    public ReservedByDto? ReservedBy { get; set; }

    public string? OfficeTableName { get; set; }
    public int? ReservedByUserId { get; set; }
    public string? ReservedByUserName { get; set; }
    public DateTime? ReservationDate { get; set; }
}

public class ReservedByDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
}
