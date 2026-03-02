using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.InternalRequest;
using PFE.Application.Services;
using System.Security.Claims;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InternalRequestController : ControllerBase
{
    private readonly IInternalRequestService _internalRequestService;

    public InternalRequestController(IInternalRequestService internalRequestService)
    {
        _internalRequestService = internalRequestService;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<InternalRequestDto>>> CreateRequest([FromBody] CreateInternalRequestDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _internalRequestService.CreateRequestAsync(userId, dto);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<InternalRequestDto>.ErrorResponse("Failed to create request"));
        }

        return Ok(ApiResponse<InternalRequestDto>.SuccessResponse(result, "Request created successfully"));
    }

    [HttpGet("my")]
    public async Task<ActionResult<ApiResponse<List<InternalRequestDto>>>> GetMyRequests()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var requests = await _internalRequestService.GetUserRequestsAsync(userId);
        return Ok(ApiResponse<List<InternalRequestDto>>.SuccessResponse(requests));
    }

    [HttpGet("category/{category}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<List<InternalRequestDto>>>> GetRequestsByCategory(string category)
    {
        var requests = await _internalRequestService.GetRequestsByCategoryAsync(category);
        return Ok(ApiResponse<List<InternalRequestDto>>.SuccessResponse(requests));
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<InternalRequestDto>>> UpdateRequestStatus(
        int id, 
        [FromBody] UpdateRequestStatusDto dto)
    {
        var result = await _internalRequestService.UpdateRequestStatusAsync(
            id, 
            dto.Status, 
            dto.Comment, 
            dto.AssignedToId);
        
        if (result == null)
        {
            return BadRequest(ApiResponse<InternalRequestDto>.ErrorResponse("Request not found"));
        }

        return Ok(ApiResponse<InternalRequestDto>.SuccessResponse(result, "Request status updated successfully"));
    }
}

public class UpdateRequestStatusDto
{
    public string Status { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public int? AssignedToId { get; set; }
}

