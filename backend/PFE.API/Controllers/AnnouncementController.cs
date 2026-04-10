using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Announcement;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnnouncementController : ControllerBase
{
    private readonly IAnnouncementService _announcementService;

    public AnnouncementController(IAnnouncementService announcementService)
    {
        _announcementService = announcementService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<AnnouncementDto>>>> GetVisible()
    {
        var result = await _announcementService.GetVisibleAsync();
        return Ok(ApiResponse<List<AnnouncementDto>>.SuccessResponse(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<AnnouncementDto>>> GetById(int id)
    {
        var result = await _announcementService.GetByIdAsync(id);

        if (result == null)
            return NotFound(ApiResponse<AnnouncementDto>.ErrorResponse("Announcement not found"));

        return Ok(ApiResponse<AnnouncementDto>.SuccessResponse(result));
    }

    [Authorize(Roles = "Admin,HR")]
    [HttpGet("manage")]
    public async Task<ActionResult<ApiResponse<List<AnnouncementDto>>>> GetManageable()
    {
        var result = await _announcementService.GetManageableAsync();
        return Ok(ApiResponse<List<AnnouncementDto>>.SuccessResponse(result));
    }

    [Authorize(Roles = "Admin,HR")]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<AnnouncementDto>>> Create([FromBody] CreateAnnouncementDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _announcementService.CreateAsync(userId, dto);

        return Ok(ApiResponse<AnnouncementDto>.SuccessResponse(result, "Announcement created successfully"));
    }

    [Authorize(Roles = "Admin,HR")]
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<AnnouncementDto>>> Update(int id, [FromBody] UpdateAnnouncementDto dto)
    {
        var result = await _announcementService.UpdateAsync(id, dto);

        if (result == null)
            return NotFound(ApiResponse<AnnouncementDto>.ErrorResponse("Announcement not found"));

        return Ok(ApiResponse<AnnouncementDto>.SuccessResponse(result, "Announcement updated successfully"));
    }

    [Authorize(Roles = "Admin,HR")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _announcementService.DeleteAsync(id);

        if (!deleted)
            return NotFound(ApiResponse<string>.ErrorResponse("Announcement not found"));

        return Ok(ApiResponse<string>.SuccessResponse("", "Announcement deleted successfully"));
    }
}