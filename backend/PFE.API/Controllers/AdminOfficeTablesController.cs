using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.Common;
using PFE.Application.DTOs.OfficeTable;
using PFE.Application.Services;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/officetables")]
[Authorize(Roles = "Admin,HR")]
public class AdminOfficeTablesController : ControllerBase
{
    private readonly IOfficeTableService _officeTableService;

    public AdminOfficeTablesController(IOfficeTableService officeTableService)
    {
        _officeTableService = officeTableService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<OfficeTableDto>>>> GetAllOfficeTables()
    {
        var tables = await _officeTableService.GetAllOfficeTablesAsync();
        return Ok(ApiResponse<List<OfficeTableDto>>.SuccessResponse(tables));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<OfficeTableDto>>> GetOfficeTableById(int id)
    {
        var table = await _officeTableService.GetOfficeTableByIdAsync(id);
        if (table == null)
            return NotFound(ApiResponse<OfficeTableDto>.ErrorResponse("OfficeTable not found"));

        return Ok(ApiResponse<OfficeTableDto>.SuccessResponse(table));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<OfficeTableDto>>> CreateOfficeTable([FromBody] CreateOfficeTableDto dto)
    {
        var table = await _officeTableService.CreateOfficeTableAsync(dto);
        return CreatedAtAction(nameof(GetOfficeTableById), new { id = table.Id }, ApiResponse<OfficeTableDto>.SuccessResponse(table, "OfficeTable created successfully"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<OfficeTableDto>>> UpdateOfficeTable(int id, [FromBody] UpdateOfficeTableDto dto)
    {
        var table = await _officeTableService.UpdateOfficeTableAsync(id, dto);
        if (table == null)
            return NotFound(ApiResponse<OfficeTableDto>.ErrorResponse("OfficeTable not found"));

        return Ok(ApiResponse<OfficeTableDto>.SuccessResponse(table, "OfficeTable updated successfully"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteOfficeTable(int id)
    {
        var deleted = await _officeTableService.DeleteOfficeTableAsync(id);
        if (!deleted)
            return NotFound(ApiResponse<object>.ErrorResponse("OfficeTable not found"));

        return Ok(ApiResponse<object>.SuccessResponse(null, "OfficeTable deleted successfully"));
    }
}
