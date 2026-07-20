using PFE.Domain.Entities;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public static class RoomReservationLifecycle
{
    public static readonly TimeSpan StartWindowLeadTime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan StartGracePeriod = TimeSpan.FromMinutes(10);

    public static DateTime StartDeadline(RoomReservation reservation)
    {
        return reservation.StartDateTime.Add(StartGracePeriod);
    }

    public static bool IsOverdueActiveUnstarted(RoomReservation reservation, DateTime now)
    {
        return reservation.Status == ReservationStatus.Active &&
               reservation.StartedAt == null &&
               now > StartDeadline(reservation);
    }

    public static bool ExpireIfOverdue(RoomReservation reservation, DateTime now)
    {
        if (!IsOverdueActiveUnstarted(reservation, now))
        {
            return false;
        }

        reservation.Status = ReservationStatus.Expired;
        return true;
    }
}
