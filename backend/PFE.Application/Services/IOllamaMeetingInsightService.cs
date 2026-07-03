namespace PFE.Application.Services;

public interface IOllamaMeetingInsightService
{
    Task<OllamaMeetingInsights> GenerateAsync(string transcript);
}

public sealed record OllamaMeetingInsights(string Summary, string Tasks);
