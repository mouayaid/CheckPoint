namespace PFE.Application.Abstractions;

public interface IAppTimeProvider
{
    DateTime UtcNow { get; }
    DateTime TunisiaNow { get; }
    DateOnly TunisiaToday { get; }
    TimeOnly TunisiaCurrentTime { get; }
    DateTime ConvertUtcToTunisia(DateTime utcDateTime);
    DateTime ConvertTunisiaToUtc(DateTime tunisiaLocalDateTime);
}
