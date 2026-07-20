using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? ProfileImagePublicId { get; set; }
    public string? ExpoPushToken { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public int? DepartmentId { get; set; }
    public Department? Department { get; set; }
    public decimal? LeaveBalance { get; set; }
    public decimal? YearlySalary { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = false;
    public DateTime? ApprovedAt { get; set; }
    public int? ApprovedByUserId { get; set; }

    public DateTime? RejectedAt { get; set; }
    public int? RejectedById { get; set; }
    public string? RejectionReason { get; set; }

    public ICollection<SeatReservation> SeatReservations { get; set; } = new List<SeatReservation>();
    public ICollection<RoomReservation> RoomReservations { get; set; } = new List<RoomReservation>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
    public ICollection<GeneralRequest> GeneralRequests { get; set; } = new List<GeneralRequest>();
    public ICollection<Event> CreatedEvents { get; set; } = new List<Event>();
    public ICollection<EventParticipant> EventParticipants { get; set; } = new List<EventParticipant>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public ICollection<LeaveRequest> ManagedLeaveRequests { get; set; } = new List<LeaveRequest>();
    public ICollection<GeneralRequest> AssignedGeneralRequests { get; set; } = new List<GeneralRequest>();

    public ICollection<DepartmentChannelMessage> SentDepartmentMessages { get; set; } = new List<DepartmentChannelMessage>();
    public ICollection<DepartmentPollVote> DepartmentPollVotes { get; set; } = new List<DepartmentPollVote>();

    public ICollection<DepartmentChannelReadState> DepartmentChannelReadStates { get; set; } = new List<DepartmentChannelReadState>();
}
