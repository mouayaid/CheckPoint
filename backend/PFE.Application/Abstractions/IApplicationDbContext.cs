using Microsoft.EntityFrameworkCore;
using PFE.Domain.Entities;

namespace PFE.Application.Abstractions;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Department> Departments { get; }

    DbSet<Desk> Desks { get; }
DbSet<DeskReservation> DeskReservations { get; }
DbSet<InternalRequest> InternalRequests { get; }


    DbSet<OfficeTable> OfficeTables { get; }
    DbSet<Seat> Seats { get; }
    DbSet<SeatReservation> SeatReservations { get; }

    DbSet<Room> Rooms { get; }
    DbSet<RoomReservation> RoomReservations { get; }

    DbSet<LeaveRequest> LeaveRequests { get; }
    DbSet<AbsenceRequest> AbsenceRequests { get; }
    DbSet<GeneralRequest> GeneralRequests { get; }

    DbSet<Event> Events { get; }
    DbSet<EventParticipant> EventParticipants { get; }

    DbSet<Notification> Notifications { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
