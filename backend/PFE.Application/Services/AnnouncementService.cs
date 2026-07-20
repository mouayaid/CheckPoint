using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.Announcement;
using PFE.Domain.Entities;

namespace PFE.Application.Services;

public class AnnouncementService : IAnnouncementService
{
    private readonly IApplicationDbContext _context;
    private readonly CloudinaryService _cloudinaryService;
    private readonly IAppTimeProvider _timeProvider;
    private readonly INotificationService _notificationService;

    public AnnouncementService(
        IApplicationDbContext context,
        CloudinaryService cloudinaryService,
        IAppTimeProvider timeProvider,
        INotificationService notificationService)
    {
        _context = context;
        _cloudinaryService = cloudinaryService;
        _timeProvider = timeProvider;
        _notificationService = notificationService;
    }

    public async Task<AnnouncementDto> CreateAsync(int userId, CreateAnnouncementDto dto)
    {
        var publishAtUtc = NormalizeScheduledInputToUtc(dto.PublishAt);
        var expiresAtUtc = NormalizeScheduledInputToUtc(dto.ExpiresAt);

        if (publishAtUtc.HasValue && expiresAtUtc.HasValue && expiresAtUtc <= publishAtUtc)
        {
            throw new BadRequestException("Expiry time must be after publish time.");
        }

        var imageUrl = await _cloudinaryService.UploadImageAsync(dto.Image);

        var announcement = new Announcement
        {
            Title = dto.Title,
            Content = dto.Content,
            PublishAt = publishAtUtc,
            ExpiresAt = expiresAtUtc,
            ImageUrl = imageUrl,
            CreatedById = userId,
            CreatedAt = _timeProvider.UtcNow,
            IsActive = true
        };

        _context.Announcements.Add(announcement);
        await _context.SaveChangesAsync();

        var recipientIds = await _context.Users
            .Where(u =>
                u.Id != userId &&
                u.IsActive &&
                u.ApprovedAt != null &&
                u.RejectedAt == null)
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.CreateNotificationsAsync(
            recipientIds,
            "New Announcement",
            $"New announcement: {announcement.Title}",
            "Info",
            "Announcement",
            announcement.Id);

        var created = await _context.Announcements
            .Include(a => a.CreatedBy)
            .FirstAsync(a => a.Id == announcement.Id);

        return Map(created);
    }

    public async Task<List<AnnouncementDto>> GetVisibleAsync()
    {
        var now = _timeProvider.UtcNow;

        var announcements = await _context.Announcements
            .Include(a => a.CreatedBy)
            .Where(a =>
                a.IsActive &&
                (a.PublishAt == null || a.PublishAt <= now) &&
                (a.ExpiresAt == null || a.ExpiresAt > now))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return announcements.Select(Map).ToList();
    }

    public async Task<List<AnnouncementDto>> GetManageableAsync()
    {
        var announcements = await _context.Announcements
            .Include(a => a.CreatedBy)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return announcements.Select(Map).ToList();
    }

    public async Task<AnnouncementDto?> GetByIdAsync(int id)
    {
        var now = _timeProvider.UtcNow;

        var announcement = await _context.Announcements
            .Include(a => a.CreatedBy)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (announcement == null) return null;
        if (!announcement.IsActive) return null;
        if (announcement.PublishAt.HasValue && announcement.PublishAt > now) return null;
        if (announcement.ExpiresAt.HasValue && announcement.ExpiresAt <= now) return null;

        return Map(announcement);
    }

    public async Task<AnnouncementDto?> UpdateAsync(int id, UpdateAnnouncementDto dto)
    {
        var publishAtUtc = NormalizeScheduledInputToUtc(dto.PublishAt);
        var expiresAtUtc = NormalizeScheduledInputToUtc(dto.ExpiresAt);

        if (publishAtUtc.HasValue && expiresAtUtc.HasValue && expiresAtUtc <= publishAtUtc)
        {
            throw new BadRequestException("Expiry time must be after publish time.");
        }

        var announcement = await _context.Announcements
            .Include(a => a.CreatedBy)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (announcement == null) return null;

        announcement.Title = dto.Title;
        announcement.Content = dto.Content;
        announcement.PublishAt = publishAtUtc;
        announcement.ExpiresAt = expiresAtUtc;
        announcement.UpdatedAt = _timeProvider.UtcNow;

        await _context.SaveChangesAsync();

        return Map(announcement);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var announcement = await _context.Announcements
            .FirstOrDefaultAsync(a => a.Id == id);

        if (announcement == null) return false;

        _context.Announcements.Remove(announcement);
        await _context.SaveChangesAsync();

        return true;
    }

    private DateTime? NormalizeScheduledInputToUtc(DateTime? dateTime)
    {
        if (!dateTime.HasValue)
        {
            return null;
        }

        if (dateTime.Value.Kind == DateTimeKind.Utc)
        {
            return dateTime.Value;
        }

        var tunisiaLocal = DateTime.SpecifyKind(dateTime.Value, DateTimeKind.Unspecified);
        return _timeProvider.ConvertTunisiaToUtc(tunisiaLocal);
    }

    private static AnnouncementDto Map(Announcement a)
    {
        return new AnnouncementDto
        {
            Id = a.Id,
            Title = a.Title,
            Content = a.Content,
            ImageUrl = a.ImageUrl,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt,
            PublishAt = a.PublishAt,
            ExpiresAt = a.ExpiresAt,
            CreatedById = a.CreatedById,
            CreatedByName = a.CreatedBy != null ? a.CreatedBy.FullName : string.Empty
        };
    }
}
