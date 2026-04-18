using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Room;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/rooms")]
[Authorize(Roles = "Admin,HR")]
public class AdminRoomsController : ControllerBase
{
    private readonly IRoomService _roomService;

    public AdminRoomsController(IRoomService roomService)
    {
        _roomService = roomService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RoomDto>>>> GetAllRooms()
    {
        var rooms = await _roomService.GetAllRoomsAsync();
        return Ok(ApiResponse<List<RoomDto>>.SuccessResponse(rooms));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<RoomDto>>> GetRoomById(int id)
    {
        var room = await _roomService.GetRoomByIdAsync(id);
        if (room == null)
            return NotFound(ApiResponse<RoomDto>.ErrorResponse("Room not found"));

        return Ok(ApiResponse<RoomDto>.SuccessResponse(room));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<RoomDto>>> CreateRoom([FromBody] CreateRoomDto dto)
    {
        var room = await _roomService.CreateRoomAsync(dto);
        return CreatedAtAction(nameof(GetRoomById), new { id = room.Id }, ApiResponse<RoomDto>.SuccessResponse(room, "Room created successfully"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<RoomDto>>> UpdateRoom(int id, [FromBody] UpdateRoomDto dto)
    {
        var room = await _roomService.UpdateRoomAsync(id, dto);
        if (room == null)
            return NotFound(ApiResponse<RoomDto>.ErrorResponse("Room not found"));

        return Ok(ApiResponse<RoomDto>.SuccessResponse(room, "Room updated successfully"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteRoom(int id)
    {
        var deleted = await _roomService.DeleteRoomAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<object>.ErrorResponse("Room not found"));

        return Ok(ApiResponse<object>.SuccessResponse(null, "Room deleted successfully"));
    }
}
