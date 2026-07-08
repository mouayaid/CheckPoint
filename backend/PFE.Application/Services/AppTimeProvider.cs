using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class AppTimeProvider : IAppTimeProvider
{
    private static readonly TimeZoneInfo TunisiaTimeZone = ResolveTunisiaTimeZone();

    public DateTime UtcNow => DateTime.UtcNow;

    public DateTime TunisiaNow => ConvertUtcToTunisia(UtcNow);

    public DateOnly TunisiaToday => DateOnly.FromDateTime(TunisiaNow);

    public TimeOnly TunisiaCurrentTime => TimeOnly.FromDateTime(TunisiaNow);

    public DateTime ConvertUtcToTunisia(DateTime utcDateTime)
    {
        var utc = utcDateTime.Kind switch
        {
            DateTimeKind.Utc => utcDateTime,
            DateTimeKind.Local => utcDateTime.ToUniversalTime(),
            _ => DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc)
        };

        return TimeZoneInfo.ConvertTimeFromUtc(utc, TunisiaTimeZone);
    }

    public DateTime ConvertTunisiaToUtc(DateTime tunisiaLocalDateTime)
    {
        if (tunisiaLocalDateTime.Kind == DateTimeKind.Utc)
        {
            return tunisiaLocalDateTime;
        }

        var localTunisia = DateTime.SpecifyKind(tunisiaLocalDateTime, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localTunisia, TunisiaTimeZone);
    }

    private static TimeZoneInfo ResolveTunisiaTimeZone()
    {
        var candidates = new[]
        {
            "Africa/Tunis",
            "Tunisia Standard Time",
            "W. Central Africa Standard Time",
            "Central European Standard Time"
        };

        foreach (var id in candidates)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone(
            "Africa/Tunis-Fallback",
            TimeSpan.FromHours(1),
            "Tunisia fallback time",
            "Tunisia fallback time");
    }
}
