using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PFE.Application.DTOs.GeneralRequest;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
using System.Data;
using System.Text.Json;

namespace PFE.Application.Services;

public class GeneralRequestService : IGeneralRequestService
{
    private const string RecoveryPermutationLeave = "Leave";
    private const string RecoveryPermutationAuthorization = "Authorization";

    private static readonly RequestStatus[] GeneralRequestStatuses =
    [
        RequestStatus.Pending,
        RequestStatus.Approved,
        RequestStatus.Rejected,
    ];
    private static readonly HashSet<string> DocumentTypes = new(StringComparer.Ordinal)
    {
        "Attestation de salaire",
        "Attestation de travail",
        "Attestation de fiche de paie",
        "Attestation de stage",
        "STC",
        "Autre",
    };

    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;
    private readonly ILogger<GeneralRequestService> _logger;
    private readonly IAppTimeProvider _timeProvider;

    public GeneralRequestService(
        IApplicationDbContext context,
        IMapper mapper,
        INotificationService notificationService,
        ILogger<GeneralRequestService> logger,
        IAppTimeProvider timeProvider)
    {
        _context = context;
        _mapper = mapper;
        _notificationService = notificationService;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public async Task<GeneralRequestDto?> CreateRequestAsync(int userId, CreateGeneralRequestDto dto)
    {
        List<RecoverySlotDto>? normalizedRecoverySlots = null;

        if (!Enum.IsDefined(typeof(RequestCategory), dto.Category))
        {
            return null;
        }

        if (dto.Category == RequestCategory.ExitAuthorization)
        {
            if (!ValidateExitAuthorization(dto, _timeProvider.TunisiaToday))
            {
                return null;
            }
        }
        else if (dto.Category == RequestCategory.RemoteWork)
        {
            if (!ValidateRemoteWork(dto))
            {
                return null;
            }
        }
        else if (dto.Category == RequestCategory.Document)
        {
            if (!ValidateDocumentRequest(dto))
            {
                return null;
            }
        }
        else if (dto.Category == RequestCategory.Recovery)
        {
            normalizedRecoverySlots = ValidateAndNormalizeRecovery(dto, _timeProvider.TunisiaToday);
        }
        else if (string.IsNullOrWhiteSpace(dto.Title) ||
            string.IsNullOrWhiteSpace(dto.Description))
        {
            return null;
        }

        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        if (dto.Category == RequestCategory.ExitAuthorization)
        {
            var authorizedDate = dto.AuthorizedDate!.Value.Date;
            var startTime = dto.StartTime!.Value;
            var endTime = dto.EndTime!.Value;

            var hasOverlap = await _context.GeneralRequests.AnyAsync(r =>
                r.UserId == userId &&
                r.Category == RequestCategory.ExitAuthorization &&
                (r.Status == RequestStatus.Pending || r.Status == RequestStatus.Approved) &&
                r.AuthorizedDate.HasValue &&
                r.AuthorizedDate.Value.Date == authorizedDate &&
                r.StartTime.HasValue &&
                r.EndTime.HasValue &&
                r.StartTime.Value < endTime &&
                r.EndTime.Value > startTime);

            if (hasOverlap)
            {
                throw new BadRequestException(
                    "You already have a pending or approved exit authorization that overlaps this time slot.");
            }
        }

        var title = dto.Category switch
        {
            RequestCategory.ExitAuthorization => "Autorisation de sortie",
            RequestCategory.RemoteWork => "Télétravail",
            RequestCategory.Recovery => "Demande de récupération",
            RequestCategory.Document => dto.DocumentType == "Autre"
                ? dto.Subject!.Trim()
                : dto.DocumentType!.Trim(),
            _ => dto.Title.Trim(),
        };

        var description = dto.Category switch
        {
            RequestCategory.ExitAuthorization => dto.Motif!.Trim(),
            RequestCategory.RemoteWork => dto.RequestText!.Trim(),
            RequestCategory.Recovery => dto.Motif!.Trim(),
            RequestCategory.Document => dto.DocumentType == "Autre"
                ? dto.RequestText!.Trim()
                : $"Demande de document : {dto.DocumentType!.Trim()}",
            _ => dto.Description.Trim(),
        };

        var request = new GeneralRequest
        {

            UserId = userId,
            Title = title,
            Description = description,
            Category = dto.Category,
            AuthorizedDate = dto.Category == RequestCategory.ExitAuthorization
                ? dto.AuthorizedDate!.Value.Date
                : null,
            StartTime = dto.Category == RequestCategory.ExitAuthorization
                ? dto.StartTime
                : null,
            EndTime = dto.Category == RequestCategory.ExitAuthorization
                ? dto.EndTime
                : null,
            TotalMinutes = dto.Category == RequestCategory.ExitAuthorization
                ? dto.TotalMinutes
                : null,
            TotalRecoveryMinutes = dto.Category == RequestCategory.Recovery
                ? dto.TotalRecoveryMinutes
                : null,
            RecoveryPermutationType = dto.Category == RequestCategory.Recovery
                ? dto.RecoveryPermutationType?.Trim()
                : null,
            RecoveryNature = dto.Category == RequestCategory.Recovery
                ? dto.RecoveryNature?.Trim()
                : null,
            RequiredRecoveryMinutes = dto.Category == RequestCategory.Recovery
                ? dto.RequiredRecoveryMinutes
                : null,

            RecoverySlotsJson = dto.Category == RequestCategory.Recovery
                ? JsonSerializer.Serialize(normalizedRecoverySlots)
                : null,
            Motif = dto.Category is RequestCategory.ExitAuthorization or RequestCategory.Recovery
                ? dto.Motif!.Trim()
                : null,
            RequestType = dto.RequestType?.Trim(),
            RequestText = dto.Category is RequestCategory.RemoteWork or RequestCategory.Document
                ? dto.RequestText?.Trim()
                : null,
            DocumentType = dto.Category == RequestCategory.Document
                ? dto.DocumentType?.Trim()
                : null,
            Subject = dto.Category == RequestCategory.Document && dto.DocumentType == "Autre"
                ? dto.Subject?.Trim()
                : null,
            Status = RequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.GeneralRequests.Add(request);
        await _context.SaveChangesAsync();

        // Notify admins based on category
        var admins = await _context.Users
            .Where(u =>
                u.Role.Name == "Admin" &&
                u.IsActive &&
                u.ApprovedAt != null &&
                u.RejectedAt == null)
            .ToListAsync();

        foreach (var admin in admins)
        {
            await _notificationService.CreateNotificationAsync(
                admin.Id,
                $"New {dto.Category} Request",
                $"{user.FullName} ({user.Department?.Name ?? "No department"}) has submitted a {dto.Category} request: {request.Title}",
                "Info",
                "GeneralRequest",
                request.Id);
        }

        // Reload with includes for mapping
        var savedRequest = await _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .FirstOrDefaultAsync(r => r.Id == request.Id);

        return _mapper.Map<GeneralRequestDto>(savedRequest);
    }

    public async Task<List<GeneralRequestDto>> GetUserRequestsAsync(int userId)
    {
        try
        {
            _logger.LogInformation(
                "Retrieving employee general requests. UserId: {UserId}",
                userId);

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                _logger.LogWarning(
                    "Authenticated employee was not found while retrieving general requests. UserId: {UserId}",
                    userId);

                return [];
            }

            _logger.LogInformation(
                "Authenticated employee exists. UserId: {UserId}, Email: {Email}",
                userId,
                user.Email);

            var requests = await _context.GeneralRequests
                .AsNoTracking()
                .Include(r => r.User)
                    .ThenInclude(u => u.Department)
                .Where(r => r.UserId == userId)
                .Where(r => GeneralRequestStatuses.Contains(r.Status))
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            _logger.LogInformation(
                "General request database query completed. UserId: {UserId}, RequestCount: {RequestCount}",
                userId,
                requests.Count);

            var requestsWithMissingUsers = requests
                .Where(r => r.User == null)
                .Select(r => r.Id)
                .ToList();

            if (requestsWithMissingUsers.Count > 0)
            {
                _logger.LogWarning(
                    "General requests with missing User navigation found. UserId: {UserId}, RequestIds: {RequestIds}",
                    userId,
                    string.Join(",", requestsWithMissingUsers));
            }

            _logger.LogInformation(
                "Mapping employee general requests to DTOs. UserId: {UserId}, RequestCount: {RequestCount}",
                userId,
                requests.Count);

            var dtos = _mapper.Map<List<GeneralRequestDto>>(requests);

            _logger.LogInformation(
                "Mapped employee general requests. UserId: {UserId}, DtoCount: {DtoCount}",
                userId,
                dtos.Count);

            return dtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error retrieving employee general requests. UserId: {UserId}",
                userId);
            throw;
        }
    }

    public async Task<List<GeneralRequestDto>> GetAllRequestsAsync(RequestStatus? status, RequestCategory? category)
    {
        var query = _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .AsQueryable();

        query = query.Where(r => GeneralRequestStatuses.Contains(r.Status));

        // Apply filters
        if (status.HasValue)
        {
            if (!GeneralRequestStatuses.Contains(status.Value))
            {
                return [];
            }

            query = query.Where(r => r.Status == status.Value);
        }

        if (category.HasValue)
        {
            query = query.Where(r => r.Category == category.Value);
        }

        var requests = await query
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<GeneralRequestDto>>(requests);
    }

    public async Task<GeneralRequestDto?> UpdateRequestStatusAsync(int requestId, int userId, UpdateGeneralRequestStatusDto dto)
    {
        if (dto.Status != RequestStatus.Approved && dto.Status != RequestStatus.Rejected)
        {
            return null;
        }

        return await ReviewRequestAsync(requestId, userId, dto.Status, dto.Comment);
    }

    public async Task<GeneralRequestDto?> ApproveRequestAsync(int requestId, int adminId, string? comment)
    {
        return await ReviewRequestAsync(requestId, adminId, RequestStatus.Approved, comment);
    }

    public async Task<GeneralRequestDto?> RejectRequestAsync(int requestId, int adminId, string? comment)
    {
        return await ReviewRequestAsync(requestId, adminId, RequestStatus.Rejected, comment);
    }

    private async Task<GeneralRequestDto?> ReviewRequestAsync(
        int requestId,
        int adminId,
        RequestStatus status,
        string? comment)
    {
        var admin = await _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == adminId);

        if (admin?.Role.Name != "Admin")
        {
            return null;
        }

        var requestState = await _context.GeneralRequests
            .AsNoTracking()
            .Where(r => r.Id == requestId)
            .Select(r => new { r.Id, r.Status })
            .FirstOrDefaultAsync();

        if (requestState == null)
        {
            return null;
        }

        if (requestState.Status != RequestStatus.Pending)
        {
            throw new ConflictException("Cette demande a déjà été traitée.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(
            IsolationLevel.Serializable);

        var resolvedAt = DateTime.UtcNow;
        var reviewedRows = await _context.GeneralRequests
            .Where(r => r.Id == requestId && r.Status == RequestStatus.Pending)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(r => r.Status, status)
                .SetProperty(r => r.AdminComment, comment)
                .SetProperty(r => r.ResolvedAt, resolvedAt));

        if (reviewedRows == 0)
        {
            throw new ConflictException("Cette demande a déjà été traitée.");
        }

        await transaction.CommitAsync();

        var reviewedRequest = await _context.GeneralRequests
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .FirstAsync(r => r.Id == requestId);

        var statusMessage = status switch
        {
            RequestStatus.Rejected => "has been rejected",
            _ => "has been approved"
        };

        if (reviewedRequest.User.IsActive &&
            reviewedRequest.User.ApprovedAt != null &&
            reviewedRequest.User.RejectedAt == null)
        {
            await _notificationService.CreateNotificationAsync(
                reviewedRequest.UserId,
                "Request Status Updated",
                $"Your {reviewedRequest.Category} request '{reviewedRequest.Title}' {statusMessage}.{(string.IsNullOrEmpty(comment) ? "" : $" Comment: {comment}")}",
                status == RequestStatus.Approved ? "Success" : "Warning",
                "GeneralRequest",
                reviewedRequest.Id);
        }

        return _mapper.Map<GeneralRequestDto>(reviewedRequest);
    }

    private static bool ValidateExitAuthorization(CreateGeneralRequestDto dto, DateOnly tunisiaToday)
    {
        if (dto.AuthorizedDate == null || DateOnly.FromDateTime(dto.AuthorizedDate.Value.Date) < tunisiaToday)
        {
            return false;
        }

        if (dto.StartTime == null || dto.EndTime == null || dto.EndTime <= dto.StartTime)
        {
            return false;
        }

        var totalMinutes = (int)(dto.EndTime.Value - dto.StartTime.Value).TotalMinutes;

        if (totalMinutes <= 0 || totalMinutes > 120)
        {
            return false;
        }

        if (dto.TotalMinutes != totalMinutes)
        {
            return false;
        }

        var motif = dto.Motif?.Trim();

        return !string.IsNullOrEmpty(motif) && motif.Length >= 10;
    }

    private static bool ValidateRemoteWork(CreateGeneralRequestDto dto)
    {
        if (!string.Equals(dto.RequestType, "RemoteWork", StringComparison.Ordinal))
        {
            return false;
        }

        var requestText = dto.RequestText?.Trim();

        return !string.IsNullOrEmpty(requestText) && requestText.Length >= 10;
    }

    private static bool ValidateDocumentRequest(CreateGeneralRequestDto dto)
    {
        if (!string.Equals(dto.RequestType, "Documents", StringComparison.Ordinal))
        {
            return false;
        }

        var documentType = dto.DocumentType?.Trim();

        if (string.IsNullOrEmpty(documentType) || !DocumentTypes.Contains(documentType))
        {
            return false;
        }

        if (documentType != "Autre")
        {
            return true;
        }

        var subject = dto.Subject?.Trim();
        var requestText = dto.RequestText?.Trim();

        return !string.IsNullOrEmpty(subject) &&
            subject.Length >= 5 &&
            !string.IsNullOrEmpty(requestText) &&
            requestText.Length >= 10;
    }

    private static List<RecoverySlotDto> ValidateAndNormalizeRecovery(CreateGeneralRequestDto dto, DateOnly tunisiaToday)
    {
        var motif = dto.Motif?.Trim();
        var recoveryPermutationType = dto.RecoveryPermutationType?.Trim();
        var recoveryNature = dto.RecoveryNature?.Trim();

        if (string.IsNullOrEmpty(motif) || motif.Length < 10)
            throw new BadRequestException("Recovery motif is required and must contain at least 10 characters.");

        if (!string.Equals(recoveryPermutationType, RecoveryPermutationLeave, StringComparison.Ordinal) &&
            !string.Equals(recoveryPermutationType, RecoveryPermutationAuthorization, StringComparison.Ordinal))
            throw new BadRequestException("Recovery permutation type is invalid.");

        if (recoveryPermutationType == RecoveryPermutationLeave && string.IsNullOrWhiteSpace(recoveryNature))
            throw new BadRequestException("Recovery nature is required for leave recovery requests.");

        if (dto.RequiredRecoveryMinutes is null or <= 0)
            throw new BadRequestException("Required recovery minutes must be greater than zero.");

        if (dto.TotalRecoveryMinutes is null or <= 0)
            throw new BadRequestException("Recovery total minutes must be greater than zero.");

        if (dto.RecoverySlots == null || dto.RecoverySlots.Count == 0)
            throw new BadRequestException("At least one recovery slot is required.");

        var normalizedSlots = new List<RecoverySlotDto>(dto.RecoverySlots.Count);
        var uniqueSlots = new HashSet<(DateTime Date, TimeSpan StartTime, TimeSpan EndTime)>();
        var calculatedTotalRecoveryMinutes = 0;

        foreach (var slot in dto.RecoverySlots)
        {
            if (!slot.Date.HasValue || slot.Date.Value == default)
                throw new BadRequestException("Recovery slot date is required.");

            var slotDate = slot.Date.Value.Date;

            if (DateOnly.FromDateTime(slotDate) < tunisiaToday)
                throw new BadRequestException("Recovery slot date cannot be in the past.");

            if (!slot.StartTime.HasValue || !slot.EndTime.HasValue)
                throw new BadRequestException("Recovery slot start and end times are required.");

            var startTime = slot.StartTime.Value;
            var endTime = slot.EndTime.Value;

            if (startTime < TimeSpan.Zero || startTime >= TimeSpan.FromDays(1) ||
                endTime <= TimeSpan.Zero || endTime > TimeSpan.FromDays(1))
                throw new BadRequestException("Recovery slot start and end times are invalid.");

            if (endTime <= startTime)
                throw new BadRequestException("Recovery slot end time must be after start time.");

            if (!uniqueSlots.Add((slotDate, startTime, endTime)))
                throw new BadRequestException("Duplicate recovery slots are not allowed.");

            var slotMinutes = (int)(endTime - startTime).TotalMinutes;

            calculatedTotalRecoveryMinutes += slotMinutes;

            normalizedSlots.Add(new RecoverySlotDto
            {
                Date = slotDate,
                StartTime = startTime,
                EndTime = endTime,
                Minutes = slotMinutes
            });
        }

        foreach (var slotsForDate in normalizedSlots.GroupBy(slot => slot.Date!.Value.Date))
        {
            var orderedSlots = slotsForDate.OrderBy(slot => slot.StartTime!.Value).ToList();

            for (var index = 1; index < orderedSlots.Count; index++)
            {
                if (orderedSlots[index].StartTime!.Value < orderedSlots[index - 1].EndTime!.Value)
                    throw new BadRequestException("Recovery slots cannot overlap.");
            }
        }

        if (calculatedTotalRecoveryMinutes != dto.TotalRecoveryMinutes.Value)
            throw new BadRequestException("Recovery slot total must equal the requested recovery minutes.");

        return normalizedSlots;
    }
}
