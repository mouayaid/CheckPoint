using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PFE.Application.DTOs.Layout;
using PFE.Application.Services;
using PFE.Application.Common;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/admin/layout")]
[Authorize(Roles = "Admin,HR")]
public class AdminLayoutController : ControllerBase
{
    private readonly IOfficeLayoutService _layoutService;

    public AdminLayoutController(IOfficeLayoutService layoutService)
    {
        _layoutService = layoutService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<AdminOfficeLayoutDto>>> GetLayout()
    {
        var layout = await _layoutService.GetAdminOfficeLayoutAsync();

        return Ok(ApiResponse<AdminOfficeLayoutDto>.SuccessResponse(layout));
    }
}