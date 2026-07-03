namespace PFE.Application.DTOs.Admin;

public class AdminStatisticsDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public int? DepartmentId { get; set; }

    public UserStatsDto Users { get; set; } = new();
    public InfrastructureStatsDto Infrastructure { get; set; } = new();

    public List<StatusCountDto> LeaveByStatus { get; set; } = new();
    public int LeaveRequestsOverlappingPeriod { get; set; }

    public List<StatusCountDto> RoomReservationByStatus { get; set; } = new();
    public int RoomReservationsOverlappingPeriod { get; set; }

    public List<StatusCountDto> SeatReservationByStatus { get; set; } = new();
    public int SeatReservationsInPeriod { get; set; }

    public List<StatusCountDto> GeneralRequestByStatus { get; set; } = new();
    public int GeneralRequestsCreatedInPeriod { get; set; }

    public int EventsStartingInPeriod { get; set; }
    public int EventParticipantsForEventsInPeriod { get; set; }

    public int AnnouncementsCreatedInPeriod { get; set; }
}

public class UserStatsDto
{
    public int Total { get; set; }
    public int Active { get; set; }
    public int PendingApproval { get; set; }
    public int RegisteredInPeriod { get; set; }
}

public class InfrastructureStatsDto
{
    public int Departments { get; set; }
    public int Rooms { get; set; }
    public int OfficeTables { get; set; }
    public int Seats { get; set; }
}

public class StatusCountDto
{
    public string Status { get; set; } = string.Empty;
    public int Count { get; set; }
}
