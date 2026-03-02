using PFE.Application.DTOs.Profile;

namespace PFE.Application.Services;

public interface IProfileService
{
    Task<ProfileDto?> GetUserProfileAsync(int userId);
}
