using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using PFE.Domain.Entities;

namespace PFE.Application.Abstractions;

public interface IApplicationDbContext
{
    DatabaseFacade Database { get; }

    DbSet<User> Users { get; }
    DbSet<Department> Departments { get; }

    DbSet<OfficeTable> OfficeTables { get; }
    DbSet<Seat> Seats { get; }
    DbSet<SeatReservation> SeatReservations { get; }

    DbSet<Room> Rooms { get; }
    DbSet<RoomReservation> RoomReservations { get; }

    DbSet<LeaveRequest> LeaveRequests { get; }
    DbSet<GeneralRequest> GeneralRequests { get; }

    DbSet<Event> Events { get; }
    DbSet<EventParticipant> EventParticipants { get; }

    DbSet<Notification> Notifications { get; }

    DbSet<DepartmentChannelMessage> DepartmentChannelMessages { get; }
    DbSet<DepartmentPoll> DepartmentPolls { get; }
    DbSet<DepartmentPollOption> DepartmentPollOptions { get; }

    DbSet<DepartmentChannelReadState> DepartmentChannelReadStates { get; }
    DbSet<DepartmentPollVote> DepartmentPollVotes { get; }
    DbSet<Announcement> Announcements { get; }
    DbSet<MeetingTranscription> MeetingTranscriptions { get; set; }

    DbSet<RefreshToken> RefreshTokens { get; }

    DbSet<PasswordResetOtp> PasswordResetOtps { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
