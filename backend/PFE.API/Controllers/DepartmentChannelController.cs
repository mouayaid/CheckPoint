using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.DTOs.ChannelMessage;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentChannelController : ControllerBase
{
    private readonly IDepartmentChannelService _departmentChannelService;

    public DepartmentChannelController(IDepartmentChannelService departmentChannelService)
    {
        _departmentChannelService = departmentChannelService;
    }

    [HttpPost("message")]
    public async Task<IActionResult> CreateMessage([FromBody] CreateDepartmentMessageDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _departmentChannelService.CreateMessageAsync(userId, dto);
        return Ok(result);
    }

    [HttpPost("poll")]
    public async Task<IActionResult> CreatePoll([FromBody] CreateDepartmentPollDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _departmentChannelService.CreatePollAsync(userId, dto);
        return Ok(result);
    }

    [HttpGet("{departmentId}")]
    public async Task<IActionResult> GetFeed(int departmentId)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _departmentChannelService.GetDepartmentFeedAsync(userId, departmentId);
        return Ok(result);
    }

    [HttpPost("polls/{pollId}/vote")]
    public async Task<IActionResult> VotePoll(int pollId, [FromBody] VoteDepartmentPollDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _departmentChannelService.VotePollAsync(userId, pollId, dto);
        return Ok(new { message = "Vote submitted successfully." });
    }
}