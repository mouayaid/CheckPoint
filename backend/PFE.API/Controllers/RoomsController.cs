using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.Room;
using PFE.Application.Abstractions;

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

    // ✅ Get all rooms
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RoomDto>>>> GetAll()
    {
        var rooms = await _roomService.GetAllAsync();
        return Ok(ApiResponse<List<RoomDto>>.SuccessResponse(rooms));
    }

    // ✅ Get room by id
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<RoomDto>>> GetById(int id)
    {
        var room = await _roomService.GetByIdAsync(id);

        if (room == null)
            return NotFound(ApiResponse<RoomDto>.ErrorResponse("Room not found."));

        return Ok(ApiResponse<RoomDto>.SuccessResponse(room));
    }

    // ✅ Create room (Admin)
    [HttpPost]
    [Authorize(Policy = "Admin")]
    public async Task<ActionResult<ApiResponse<RoomDto>>> Create([FromBody] CreateRoomDto dto)
    {
        var room = await _roomService.CreateAsync(dto);

        return Ok(ApiResponse<RoomDto>.SuccessResponse(
            room,
            "Room created successfully."
        ));
    }

    // ✅ Update room (Admin)
    [HttpPut("{id}")]
    [Authorize(Policy = "Admin")]
    public async Task<ActionResult<ApiResponse<RoomDto>>> Update(int id, [FromBody] UpdateRoomDto dto)
    {
        var updated = await _roomService.UpdateAsync(id, dto);

        if (updated == null)
            return NotFound(ApiResponse<RoomDto>.ErrorResponse("Room not found."));

        return Ok(ApiResponse<RoomDto>.SuccessResponse(
            updated,
            "Room updated successfully."
        ));
    }

    // ✅ Delete room (Admin)
    [HttpDelete("{id}")]
    [Authorize(Policy = "Admin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
    {
        var success = await _roomService.DeleteAsync(id);

        if (!success)
            return NotFound(ApiResponse<object>.ErrorResponse("Room not found."));

        return Ok(ApiResponse<object>.SuccessResponse(
            null,
            "Room deleted successfully."
        ));
    }

    // ✅ Generate permanent QR for room
    [HttpPost("{id}/generate-qr")]
    [Authorize(Policy = "Admin")]
    public async Task<ActionResult<ApiResponse<RoomDto>>> GenerateQr(int id)
    {
        var room = await _roomService.GeneratePermanentQrAsync(id);

        return Ok(ApiResponse<RoomDto>.SuccessResponse(
            room,
            "QR code generated successfully."
        ));
    }
}