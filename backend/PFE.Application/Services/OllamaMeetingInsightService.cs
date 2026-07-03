using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace PFE.Application.Services;

public sealed class OllamaMeetingInsightService : IOllamaMeetingInsightService
{
    private const string Model = "llama3.2:3b";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly ILogger<OllamaMeetingInsightService> _logger;

    public OllamaMeetingInsightService(
        HttpClient httpClient,
        ILogger<OllamaMeetingInsightService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<OllamaMeetingInsights> GenerateAsync(string transcript)
    {
        if (string.IsNullOrWhiteSpace(transcript))
            throw new ArgumentException("The meeting transcript is empty.", nameof(transcript));

        _logger.LogInformation("Calling Ollama to generate meeting insights");

        var request = new
        {
            model = Model,
            stream = false,
            format = "json",
            options = new { temperature = 0.2 },
            prompt = BuildPrompt(transcript)
        };

        using var response = await _httpClient.PostAsJsonAsync("api/generate", request);
        response.EnsureSuccessStatusCode();

        var apiResponse = await response.Content.ReadFromJsonAsync<OllamaGenerateResponse>(JsonOptions);
        if (string.IsNullOrWhiteSpace(apiResponse?.Response))
            throw new JsonException("Ollama returned an empty response field.");

        var cleanedResponse = CleanModelResponse(apiResponse.Response);
        var generatedJson = ExtractJsonObject(cleanedResponse);
        var content = JsonSerializer.Deserialize<GeneratedInsights>(generatedJson, JsonOptions);

        if (content is null || string.IsNullOrWhiteSpace(content.Summary))
            throw new JsonException("Ollama response does not contain a valid summary.");

        var cleanedSummary = CleanGeneratedText(content.Summary);
        if (string.IsNullOrWhiteSpace(cleanedSummary))
            throw new JsonException("Ollama returned an empty summary after cleanup.");
        if (IsNearTranscriptCopy(cleanedSummary, transcript))
            throw new JsonException("Ollama copied the transcript instead of summarizing it.");

        var keyPoints = CleanItems(content.KeyPoints);
        var tasks = CleanItems(content.Tasks);
        var summary = FormatSummary(cleanedSummary, keyPoints);
        var formattedTasks = string.Join(Environment.NewLine, tasks.Select(task => $"- {task}"));

        _logger.LogInformation("Ollama successfully generated meeting insights");
        return new OllamaMeetingInsights(summary, formattedTasks);
    }

    private static string BuildPrompt(string transcript) => $$"""
        Tu es un assistant spécialisé dans la synthèse de réunions professionnelles.

        Analyse la transcription, notamment lorsqu'elle est en français, puis rédige le résultat dans la langue de la transcription.

        Règles obligatoires :
        - Ne copie jamais la transcription.
        - Ne répète jamais des phrases entières de la transcription.
        - Reformule toutes les informations avec un vocabulaire professionnel.
        - Produis un résumé exécutif concis de 3 à 5 phrases maximum.
        - Même si la transcription est très courte, reformule-la au lieu de la répéter.
        - Conserve uniquement les informations importantes, décisions et conclusions.
        - Ignore les salutations, hésitations, répétitions et mots de remplissage.
        - N'invente aucune information, personne, échéance ou tâche.
        - Une tâche doit être une action concrète explicitement mentionnée ; sinon retourne un tableau vide.
        - Retourne STRICTEMENT un objet JSON valide, et rien d'autre.
        - N'utilise ni Markdown, ni explication, ni bloc de code, ni texte avant ou après le JSON.

        Structure JSON exacte :
        {
          "summary": "...",
          "keyPoints": ["...", "..."],
          "tasks": ["...", "..."]
        }

        <transcription>
        {{transcript}}
        </transcription>
        """;

    private static string FormatSummary(string summary, IReadOnlyCollection<string> keyPoints)
    {
        var formattedPoints = keyPoints.Count == 0
            ? "- Aucun point important identifié."
            : string.Join(Environment.NewLine, keyPoints.Select(point => $"- {point}"));

        return $"Résumé:{Environment.NewLine}{summary.Trim()}{Environment.NewLine}{Environment.NewLine}" +
               $"Points importants:{Environment.NewLine}{formattedPoints}";
    }

    private static List<string> CleanItems(IEnumerable<string>? items) => items?
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .Select(CleanGeneratedText)
        .Select(item => item.TrimStart('-', '*', '•', ' '))
        .Where(item => item.Length > 0)
        .ToList() ?? [];

    private static string CleanModelResponse(string text)
    {
        var cleaned = MeetingTextCleaner.CleanText(text);
        cleaned = Regex.Replace(cleaned, @"```(?:json)?", string.Empty, RegexOptions.IgnoreCase);
        return cleaned.Replace("```", string.Empty, StringComparison.Ordinal).Trim();
    }

    private static string CleanGeneratedText(string? text)
    {
        var cleaned = MeetingTextCleaner.CleanText(text);
        cleaned = Regex.Replace(cleaned, @"(?m)^\s{0,3}#{1,6}\s*", string.Empty);
        cleaned = cleaned
            .Replace("**", string.Empty, StringComparison.Ordinal)
            .Replace("__", string.Empty, StringComparison.Ordinal)
            .Replace("`", string.Empty, StringComparison.Ordinal);
        return MeetingTextCleaner.CleanText(cleaned);
    }

    private static bool IsNearTranscriptCopy(string summary, string transcript)
    {
        static string[] Words(string value) => Regex
            .Matches(value.ToLowerInvariant(), @"[\p{L}\p{N}]+")
            .Select(match => match.Value)
            .ToArray();

        var summaryWords = Words(summary);
        var transcriptWords = Words(transcript);
        if (summaryWords.Length == 0 || transcriptWords.Length == 0)
            return false;

        if (summaryWords.SequenceEqual(transcriptWords))
            return true;

        var lengthRatio = (double)summaryWords.Length / transcriptWords.Length;
        if (lengthRatio < 0.65 || summaryWords.Length < 6)
            return false;

        var transcriptBigrams = transcriptWords
            .Zip(transcriptWords.Skip(1), (first, second) => $"{first}\u001F{second}")
            .ToHashSet(StringComparer.Ordinal);
        var summaryBigrams = summaryWords
            .Zip(summaryWords.Skip(1), (first, second) => $"{first}\u001F{second}")
            .ToArray();

        return summaryBigrams.Length > 0 &&
               summaryBigrams.Count(transcriptBigrams.Contains) / (double)summaryBigrams.Length >= 0.85;
    }

    private static string ExtractJsonObject(string text)
    {
        var start = text.IndexOf('{');
        if (start < 0)
            throw new JsonException("No JSON object was found in the Ollama response.");

        var depth = 0;
        var inString = false;
        var escaped = false;

        for (var index = start; index < text.Length; index++)
        {
            var character = text[index];

            if (inString)
            {
                if (escaped)
                {
                    escaped = false;
                }
                else if (character == '\\')
                {
                    escaped = true;
                }
                else if (character == '"')
                {
                    inString = false;
                }

                continue;
            }

            if (character == '"')
            {
                inString = true;
            }
            else if (character == '{')
            {
                depth++;
            }
            else if (character == '}' && --depth == 0)
            {
                return text[start..(index + 1)];
            }
        }

        throw new JsonException("The JSON object in the Ollama response is incomplete.");
    }

    private sealed class OllamaGenerateResponse
    {
        public string? Response { get; set; }
    }

    private sealed class GeneratedInsights
    {
        public string? Summary { get; set; }
        public List<string>? KeyPoints { get; set; }
        public List<string>? Tasks { get; set; }
    }
}
