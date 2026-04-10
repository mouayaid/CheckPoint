using PFE.Application.DTOs.Announcement;

namespace PFE.Application.Services;

public interface IAnnouncementService
{
    Task<AnnouncementDto> CreateAsync(int userId, CreateAnnouncementDto dto);
    Task<List<AnnouncementDto>> GetVisibleAsync();
    Task<List<AnnouncementDto>> GetManageableAsync();
    Task<AnnouncementDto?> GetByIdAsync(int id);
    Task<AnnouncementDto?> UpdateAsync(int id, UpdateAnnouncementDto dto);
    Task<bool> DeleteAsync(int id);
}