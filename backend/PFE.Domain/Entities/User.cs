using PFE.Domain.Enums;

namespace PFE.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public Role Role { get; set; } = Role.Employee;
    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;
    public int? LeaveBalance { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = false;
    public DateTime? ApprovedAt { get; set; }
    public int? ApprovedByUserId { get; set; }
    
    // Navigation properties
    public ICollection<SeatReservation> SeatReservations { get; set; } = new List<SeatReservation>();
    public ICollection<RoomReservation> RoomReservations { get; set; } = new List<RoomReservation>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
    public ICollection<AbsenceRequest> AbsenceRequests { get; set; } = new List<AbsenceRequest>();
    public ICollection<GeneralRequest> GeneralRequests { get; set; } = new List<GeneralRequest>();
    public ICollection<Event> CreatedEvents { get; set; } = new List<Event>();
    public ICollection<EventParticipant> EventParticipants { get; set; } = new List<EventParticipant>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    
    // Manager relationships
    public ICollection<LeaveRequest> ManagedLeaveRequests { get; set; } = new List<LeaveRequest>();
    public ICollection<AbsenceRequest> ManagedAbsenceRequests { get; set; } = new List<AbsenceRequest>();
    public ICollection<GeneralRequest> AssignedGeneralRequests { get; set; } = new List<GeneralRequest>();
}
