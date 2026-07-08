using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Admin;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/statistics")]
[Authorize(Roles = "Admin")]
public class AdminStatisticsController : ControllerBase
{
    private readonly IAdminStatisticsService _statisticsService;
    private readonly IAdminChatbotService _adminChatbotService;

    public AdminStatisticsController(
        IAdminStatisticsService statisticsService,
        IAdminChatbotService adminChatbotService)
    {
        _statisticsService = statisticsService;
        _adminChatbotService = adminChatbotService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<AdminStatisticsDto>>> GetStatistics(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? departmentId)
    {
        var dto = await _statisticsService.GetStatisticsAsync(from, to, departmentId);
        return Ok(ApiResponse<AdminStatisticsDto>.SuccessResponse(dto));
    }

    [HttpPost("chat")]
    public async Task<ActionResult<AdminStatisticsChatResponseDto>> Chat(
        [FromBody] AdminStatisticsChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { message = "A message is required." });

        return Ok(await _adminChatbotService.AnswerAsync(request));
    }
}
