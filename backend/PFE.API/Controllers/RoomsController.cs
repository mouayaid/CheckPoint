using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Room;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoomsController : ControllerBase
{
    private readonly IRoomService _roomService;

    public RoomsController(IRoomService roomService)
    {
        _roomService = roomService;
    }

    /// <summary>
    /// Get all active rooms
    /// </summary>
    /// <returns>List of active rooms</returns>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RoomDto>>>> GetActiveRooms()
    {
        var rooms = await _roomService.GetAllRoomsAsync();
        return Ok(ApiResponse<List<RoomDto>>.SuccessResponse(rooms));
    }
}

