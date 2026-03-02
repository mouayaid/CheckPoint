using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Profile;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;

    public ProfileController(IProfileService profileService)
    {
        _profileService = profileService;
    }

    /// <summary>
    /// Get current user's profile with unified history
    /// </summary>
    /// <returns>User info and unified history list (seat reservations, room reservations, leave requests, absence requests, general requests)</returns>
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> GetMyProfile()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var profile = await _profileService.GetUserProfileAsync(userId);

        if (profile == null)
        {
            return NotFound(ApiResponse<ProfileDto>.ErrorResponse("User not found"));
        }

        return Ok(ApiResponse<ProfileDto>.SuccessResponse(profile));
    }
}
