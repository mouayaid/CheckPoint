namespace PFE.Application.DTOs.Profile;

public class ProfileHistoryDto
{
    public List<DeskReservationHistoryDto> DeskReservations { get; set; } = new();
    public List<RoomReservationHistoryDto> RoomReservations { get; set; } = new();
    public List<LeaveRequestHistoryDto> LeaveRequests { get; set; } = new();
    public List<InternalRequestHistoryDto> InternalRequests { get; set; } = new();
}

public class DeskReservationHistoryDto
{
    public int Id { get; set; }
    public string DeskName { get; set; } = string.Empty;
    public DateTime ReservationDate { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class RoomReservationHistoryDto
{
    public int Id { get; set; }
    public string RoomName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class LeaveRequestHistoryDto
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class InternalRequestHistoryDto
{
    public int Id { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

