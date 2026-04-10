using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.Announcement;
using PFE.Domain.Entities;

namespace PFE.Application.Services;

public class AnnouncementService : IAnnouncementService
{
    private readonly IApplicationDbContext _context;

    public AnnouncementService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AnnouncementDto> CreateAsync(int userId, CreateAnnouncementDto dto)
    {
        if (dto.PublishAt.HasValue && dto.ExpiresAt.HasValue && dto.ExpiresAt <= dto.PublishAt)
        {
            throw new Exception("Expiry time must be after publish time.");
        }

        var announcement = new Announcement
        {
            Title = dto.Title,
            Content = dto.Content,
            PublishAt = dto.PublishAt,
            ExpiresAt = dto.ExpiresAt,
            CreatedById = userId,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.Announcements.Add(announcement);
        await _context.SaveChangesAsync();

        var created = await _context.Announcements
            .Include(a => a.CreatedBy)
            .FirstAsync(a => a.Id == announcement.Id);

        return Map(created);
    }

    public async Task<List<AnnouncementDto>> GetVisibleAsync()
    {
        var now = DateTime.UtcNow;

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
        var now = DateTime.UtcNow;

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
        if (dto.PublishAt.HasValue && dto.ExpiresAt.HasValue && dto.ExpiresAt <= dto.PublishAt)
        {
            throw new Exception("Expiry time must be after publish time.");
        }

        var announcement = await _context.Announcements
            .Include(a => a.CreatedBy)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (announcement == null) return null;

        announcement.Title = dto.Title;
        announcement.Content = dto.Content;
        announcement.PublishAt = dto.PublishAt;
        announcement.ExpiresAt = dto.ExpiresAt;
        announcement.UpdatedAt = DateTime.UtcNow;

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

    private static AnnouncementDto Map(Announcement a)
    {
        return new AnnouncementDto
        {
            Id = a.Id,
            Title = a.Title,
            Content = a.Content,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt,
            PublishAt = a.PublishAt,
            ExpiresAt = a.ExpiresAt,
            CreatedById = a.CreatedById,
            CreatedByName = a.CreatedBy != null ? a.CreatedBy.FullName : string.Empty
        };
    }
}