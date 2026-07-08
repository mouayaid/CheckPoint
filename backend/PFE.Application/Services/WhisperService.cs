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
    private static readonly TimeSpan PythonProcessTimeout = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan PythonTerminationTimeout = TimeSpan.FromSeconds(10);

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

        var operationSucceeded = false;

        try
        {
            await using (var stream = new FileStream(audioPath, FileMode.Create))
            {
                await audioFile.CopyToAsync(stream);
            }

            var transcript = MeetingTextCleaner.CleanText(
                await RunFasterWhisperAsync(audioPath, reservationId));

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
                _logger.LogWarning(
                    ex,
                    "Ollama insight generation failed for reservation {ReservationId}; using fallback insights.",
                    reservationId);
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

            operationSucceeded = true;
            return ToDto(entity);
        }
        catch (TranscriptionProcessingException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Meeting transcription failed for reservation {ReservationId}.",
                reservationId);
            throw new TranscriptionProcessingException(
                "La transcription a échoué. Veuillez réessayer.",
                ex);
        }
        finally
        {
            if (!operationSucceeded)
            {
                TryDeleteFailedAudio(audioPath, reservationId);
            }
        }
    }

    public async Task<List<MeetingTranscriptionDto>> GetByReservationAsync(int reservationId)
    {
        return await _context.MeetingTranscriptions
            .Where(x => x.RoomReservationId == reservationId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => ToDto(x))
            .ToListAsync();
    }

    private async Task<string> RunFasterWhisperAsync(string audioPath, int reservationId)
    {
        var scriptPath = ResolveTranscribeScriptPath();

        if (!File.Exists(scriptPath))
            throw new TranscriptionProcessingException(
                "Le service de transcription est temporairement indisponible.");

        using var process = new Process
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

        try
        {
            process.Start();
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to start Faster-Whisper for reservation {ReservationId}.",
                reservationId);
            throw new TranscriptionProcessingException(
                "Le service de transcription est temporairement indisponible.",
                ex);
        }

        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();

        using var timeoutCancellation = new CancellationTokenSource(PythonProcessTimeout);
        try
        {
            await process.WaitForExitAsync(timeoutCancellation.Token);
        }
        catch (OperationCanceledException) when (timeoutCancellation.IsCancellationRequested)
        {
            _logger.LogError(
                "Faster-Whisper timed out after {TimeoutMinutes} minutes for reservation {ReservationId}.",
                PythonProcessTimeout.TotalMinutes,
                reservationId);

            await TerminateProcessAsync(process, reservationId);
            await DrainProcessStreamsAsync(outputTask, errorTask, reservationId);
            throw new TranscriptionProcessingException(
                "La transcription a pris trop de temps. Veuillez réessayer avec un enregistrement plus court.");
        }

        var output = await outputTask;
        await errorTask;

        if (process.ExitCode != 0)
        {
            _logger.LogError(
                "Faster-Whisper exited with code {ExitCode} for reservation {ReservationId}.",
                process.ExitCode,
                reservationId);
            throw new TranscriptionProcessingException(
                "La transcription audio a échoué. Veuillez vérifier le fichier et réessayer.");
        }

        var jsonLine = ExtractFinalJsonLine(output);

        if (string.IsNullOrWhiteSpace(jsonLine))
        {
            _logger.LogError(
                "Faster-Whisper returned malformed output for reservation {ReservationId}.",
                reservationId);
            throw new TranscriptionProcessingException(
                "La réponse du service de transcription était invalide. Veuillez réessayer.");
        }

        WhisperPythonResult? result;
        try
        {
            result = JsonSerializer.Deserialize<WhisperPythonResult>(
                jsonLine,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );
        }
        catch (JsonException ex)
        {
            _logger.LogError(
                ex,
                "Failed to parse Faster-Whisper output for reservation {ReservationId}.",
                reservationId);
            throw new TranscriptionProcessingException(
                "La réponse du service de transcription était invalide. Veuillez réessayer.",
                ex);
        }

        if (result == null)
            throw new TranscriptionProcessingException(
                "La réponse du service de transcription était invalide. Veuillez réessayer.");

        if (!result.Success)
        {
            _logger.LogError(
                "Faster-Whisper reported a processing failure for reservation {ReservationId}.",
                reservationId);
            throw new TranscriptionProcessingException(
                "La transcription audio a échoué. Veuillez vérifier le fichier et réessayer.");
        }

        return MeetingTextCleaner.CleanText(result.Text);
    }

    private async Task TerminateProcessAsync(Process process, int reservationId)
    {
        try
        {
            if (process.HasExited)
                return;

            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (NotSupportedException)
            {
                process.Kill();
            }

            using var terminationCancellation = new CancellationTokenSource(PythonTerminationTimeout);
            await process.WaitForExitAsync(terminationCancellation.Token);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to terminate timed-out Faster-Whisper process for reservation {ReservationId}.",
                reservationId);
        }
    }

    private async Task DrainProcessStreamsAsync(
        Task<string> outputTask,
        Task<string> errorTask,
        int reservationId)
    {
        try
        {
            await Task.WhenAll(outputTask, errorTask).WaitAsync(PythonTerminationTimeout);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to finish draining Faster-Whisper output after timeout for reservation {ReservationId}.",
                reservationId);
        }
    }

    private void TryDeleteFailedAudio(string audioPath, int reservationId)
    {
        try
        {
            if (File.Exists(audioPath))
            {
                File.Delete(audioPath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to delete audio from unsuccessful transcription for reservation {ReservationId}.",
                reservationId);
        }
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

public sealed class TranscriptionProcessingException : Exception
{
    public TranscriptionProcessingException(string message)
        : base(message)
    {
    }

    public TranscriptionProcessingException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
