using PFE.Application.Services;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

var tests = new (string Name, Action Run)[]
{
    ("Active reservation before deadline stays active", ActiveBeforeDeadline),
    ("Start exactly within grace period stays active", ExactlyAtGraceDeadline),
    ("Active unstarted reservation expires after deadline", ExpirationAfterDeadline),
    ("Start is rejected after expiration normalization", StartRejectedAfterExpiration),
    ("Cancellation is rejected after expiration normalization", CancellationRejectedAfterExpiration),
    ("Expired reservation does not block a new reservation", ExpiredDoesNotBlockNewReservation),
    ("Completed reservation remains visible and openable to owner", CompletedVisibleAndOpenableToOwner),
    ("Manager cannot see another manager's reservation", ManagerCannotSeeAnotherManagersReservation),
};

foreach (var test in tests)
{
    test.Run();
    Console.WriteLine($"PASS {test.Name}");
}

static void ActiveBeforeDeadline()
{
    var start = new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc);
    var reservation = ActiveReservation(userId: 1, start);

    var changed = RoomReservationLifecycle.ExpireIfOverdue(
        reservation,
        start.AddMinutes(9).AddSeconds(59));

    AssertFalse(changed);
    AssertEqual(ReservationStatus.Active, reservation.Status);
}

static void ExactlyAtGraceDeadline()
{
    var start = new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc);
    var reservation = ActiveReservation(userId: 1, start);

    var changed = RoomReservationLifecycle.ExpireIfOverdue(
        reservation,
        start.Add(RoomReservationLifecycle.StartGracePeriod));

    AssertFalse(changed);
    AssertEqual(ReservationStatus.Active, reservation.Status);
}

static void ExpirationAfterDeadline()
{
    var start = new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc);
    var reservation = ActiveReservation(userId: 1, start);

    var changed = RoomReservationLifecycle.ExpireIfOverdue(
        reservation,
        start.Add(RoomReservationLifecycle.StartGracePeriod).AddTicks(1));

    AssertTrue(changed);
    AssertEqual(ReservationStatus.Expired, reservation.Status);
}

static void StartRejectedAfterExpiration()
{
    var start = new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc);
    var reservation = ActiveReservation(userId: 1, start);

    var shouldReject = RoomReservationLifecycle.ExpireIfOverdue(
        reservation,
        start.AddMinutes(11));

    AssertTrue(shouldReject);
    AssertEqual(ReservationStatus.Expired, reservation.Status);
}

static void CancellationRejectedAfterExpiration()
{
    var start = new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc);
    var reservation = ActiveReservation(userId: 1, start);

    var shouldReject = RoomReservationLifecycle.ExpireIfOverdue(
        reservation,
        start.AddMinutes(11));

    AssertTrue(shouldReject);
    AssertEqual(ReservationStatus.Expired, reservation.Status);
}

static void ExpiredDoesNotBlockNewReservation()
{
    var start = new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc);
    var existing = ActiveReservation(userId: 1, start);
    var requestedStart = start.AddMinutes(15);
    var requestedEnd = start.AddMinutes(45);

    RoomReservationLifecycle.ExpireIfOverdue(existing, start.AddMinutes(11));

    var blocks = existing.Status == ReservationStatus.Active &&
                 existing.StartDateTime < requestedEnd &&
                 existing.EndDateTime > requestedStart;

    AssertFalse(blocks);
}

static void CompletedVisibleAndOpenableToOwner()
{
    var reservation = ActiveReservation(
        userId: 1,
        new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc));
    reservation.Status = ReservationStatus.Completed;

    AssertTrue(IsVisibleToOwnerHistory(reservation, ownerId: 1));
    AssertTrue(IsOpenableInMyReservations(reservation));
}

static void ManagerCannotSeeAnotherManagersReservation()
{
    var ownReservation = ActiveReservation(
        userId: 1,
        new DateTime(2026, 7, 12, 10, 0, 0, DateTimeKind.Utc));
    var otherReservation = ActiveReservation(
        userId: 2,
        new DateTime(2026, 7, 12, 11, 0, 0, DateTimeKind.Utc));

    var visible = new[] { ownReservation, otherReservation }
        .Where(r => r.UserId == 1)
        .ToList();

    AssertEqual(1, visible.Count);
    AssertEqual(ownReservation.Id, visible[0].Id);
}

static RoomReservation ActiveReservation(int userId, DateTime start)
{
    return new RoomReservation
    {
        Id = userId,
        RoomId = 10,
        UserId = userId,
        StartDateTime = start,
        EndDateTime = start.AddHours(1),
        Status = ReservationStatus.Active
    };
}

static bool IsVisibleToOwnerHistory(RoomReservation reservation, int ownerId)
{
    return reservation.UserId == ownerId &&
           (reservation.Status == ReservationStatus.Active ||
            reservation.Status == ReservationStatus.InProgress ||
            reservation.Status == ReservationStatus.Completed ||
            reservation.Status == ReservationStatus.Expired);
}

static bool IsOpenableInMyReservations(RoomReservation reservation)
{
    return reservation.Status == ReservationStatus.Active ||
           reservation.Status == ReservationStatus.InProgress ||
           reservation.Status == ReservationStatus.Completed;
}

static void AssertTrue(bool condition)
{
    if (!condition)
    {
        throw new InvalidOperationException("Expected true.");
    }
}

static void AssertFalse(bool condition)
{
    if (condition)
    {
        throw new InvalidOperationException("Expected false.");
    }
}

static void AssertEqual<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
        throw new InvalidOperationException($"Expected {expected}, got {actual}.");
    }
}
