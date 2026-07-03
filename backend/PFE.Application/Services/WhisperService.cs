using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.MeetingTranscription;
using PFE.Domain.Entities;

namespace PFE.Application.Services;

public class WhisperService : IWhisperService
{
    private const long MaxAudioFileSizeBytes = 25 * 1024 * 1024;

    private static readonly HashSet<string> AllowedAudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".wav", ".m4a", ".webm", ".mp4", ".aac"
    };

    private static readonly HashSet<string> AllowedAudioContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
        "audio/webm",
        "video/webm",
        "video/mp4",
        "audio/aac",
        "audio/aacp",
        "application/octet-stream"
    };

    private readonly IApplicationDbContext _context;
    private readonly IOllamaMeetingInsightService _ollamaMeetingInsightService;
    private readonly ILogger<WhisperService> _logger;

    public WhisperService(
        IApplicationDbContext context,
        IOllamaMeetingInsightService ollamaMeetingInsightService,
        ILogger<WhisperService> logger)
    {
        _context = context;
        _ollamaMeetingInsightService = ollamaMeetingInsightService;
        _logger = logger;
    }

    public async Task<MeetingTranscriptionDto> TranscribeAsync(int reservationId, IFormFile audioFile)
    {
        ValidateAudioFile(audioFile);

        var reservation = await _context.RoomReservations
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null)
            throw new Exception("Room reservation not found.");

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Meetings");
        Directory.CreateDirectory(uploadsDir);

        var extension = Path.GetExtension(audioFile.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var audioPath = Path.Combine(uploadsDir, fileName);

        await using (var stream = new FileStream(audioPath, FileMode.Create))
        {
            await audioFile.CopyToAsync(stream);
        }

        Console.WriteLine($"Meeting transcription saved audio path: {audioPath}");

        var transcript = MeetingTextCleaner.CleanText(await RunFasterWhisperAsync(audioPath));

        var summary = GenerateSimpleSummary(transcript);
        var tasks = ExtractSimpleTasks(transcript);

        try
        {
            var insights = await _ollamaMeetingInsightService.GenerateAsync(transcript);
            summary = insights.Summary;
            tasks = insights.Tasks;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama fallback: {ErrorMessage}", ex.Message);
        }

        var entity = new MeetingTranscription
        {
            RoomReservationId = reservationId,
            AudioFilePath = audioPath,
            TranscriptText = transcript,
            Summary = summary,
            Tasks = tasks,
            CreatedAt = DateTime.UtcNow
        };

        _context.MeetingTranscriptions.Add(entity);
        await _context.SaveChangesAsync();

        return ToDto(entity);
    }

    public async Task<List<MeetingTranscriptionDto>> GetByReservationAsync(int reservationId)
    {
        return await _context.MeetingTranscriptions
            .Where(x => x.RoomReservationId == reservationId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => ToDto(x))
            .ToListAsync();
    }

    private static async Task<string> RunFasterWhisperAsync(string audioPath)
    {
        var scriptPath = ResolveTranscribeScriptPath();
        Console.WriteLine($"Resolved faster-whisper script path: {scriptPath}");

        if (!File.Exists(scriptPath))
            throw new Exception($"Whisper script not found: {scriptPath}");

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "python",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        process.StartInfo.ArgumentList.Add(scriptPath);
        process.StartInfo.ArgumentList.Add(audioPath);

        process.Start();

        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        var output = await outputTask;
        var error = await errorTask;

        Console.WriteLine($"faster-whisper process exit code: {process.ExitCode}");

        if (process.ExitCode != 0)
        {
            throw new Exception(
                $"faster-whisper failed with exit code {process.ExitCode}. stderr: {error}. stdout: {output}");
        }

        var jsonLine = ExtractFinalJsonLine(output);

        if (string.IsNullOrWhiteSpace(jsonLine))
            throw new Exception($"faster-whisper returned no JSON output. stderr: {error}. stdout: {output}");

        var result = JsonSerializer.Deserialize<WhisperPythonResult>(
            jsonLine,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
        );

        if (result == null)
            throw new Exception($"Could not parse faster-whisper result. stdout: {output}");

        if (!result.Success)
        {
            throw new Exception(
                $"faster-whisper failed: {result.Error ?? "Unknown error"}. stderr: {error}. stdout: {output}");
        }

        return MeetingTextCleaner.CleanText(result.Text);
    }

    private static string ResolveTranscribeScriptPath()
    {
        var currentDirectory = Directory.GetCurrentDirectory();
        var baseDirectory = AppContext.BaseDirectory;

        var candidates = new[]
        {
            Path.Combine(currentDirectory, "..", "whisper", "transcribe.py"),
            Path.Combine(currentDirectory, "backend", "whisper", "transcribe.py"),
            Path.Combine(baseDirectory, "..", "..", "..", "..", "whisper", "transcribe.py"),
            Path.Combine(baseDirectory, "..", "..", "..", "..", "backend", "whisper", "transcribe.py")
        };

        foreach (var candidate in candidates)
        {
            var fullPath = Path.GetFullPath(candidate);
            if (File.Exists(fullPath))
            {
                return fullPath;
            }
        }

        return Path.GetFullPath(candidates[0]);
    }

    private static string? ExtractFinalJsonLine(string output)
    {
        return output
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .LastOrDefault(line => line.StartsWith("{") && line.EndsWith("}"));
    }

    private static string GenerateSimpleSummary(string text)
    {
        return "Résumé automatique indisponible.";
    }

    private static string ExtractSimpleTasks(string text)
    {
        var lines = text.Split('.', StringSplitOptions.RemoveEmptyEntries);

        var tasks = lines
            .Where(l =>
                l.Contains("doit", StringComparison.OrdinalIgnoreCase) ||
                l.Contains("à faire", StringComparison.OrdinalIgnoreCase) ||
                l.Contains("task", StringComparison.OrdinalIgnoreCase) ||
                l.Contains("todo", StringComparison.OrdinalIgnoreCase) ||
                l.Contains("responsable", StringComparison.OrdinalIgnoreCase))
            .Select(l => "- " + l.Trim());

        return string.Join(Environment.NewLine, tasks);
    }

    private static void ValidateAudioFile(IFormFile audioFile)
    {
        if (audioFile == null || audioFile.Length == 0)
            throw new ArgumentException("Audio file is required.");

        if (audioFile.Length > MaxAudioFileSizeBytes)
            throw new ArgumentException("Audio file must be 25 MB or smaller.");

        var extension = Path.GetExtension(audioFile.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedAudioExtensions.Contains(extension))
            throw new ArgumentException("Unsupported audio file extension.");

        if (!string.IsNullOrWhiteSpace(audioFile.ContentType) &&
            !AllowedAudioContentTypes.Contains(audioFile.ContentType))
        {
            Console.WriteLine(
                $"Accepting audio upload with extension '{extension}' and unrecognized content type '{audioFile.ContentType}'.");
        }
    }

    private static MeetingTranscriptionDto ToDto(MeetingTranscription x)
    {
        return new MeetingTranscriptionDto
        {
            Id = x.Id,
            RoomReservationId = x.RoomReservationId,
            TranscriptText = x.TranscriptText,
            Summary = x.Summary,
            Tasks = x.Tasks,
            CreatedAt = x.CreatedAt
        };
    }

    private sealed class WhisperPythonResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }
        public string? Language { get; set; }
        public double Language_Probability { get; set; }
        public string? Text { get; set; }
    }
}
