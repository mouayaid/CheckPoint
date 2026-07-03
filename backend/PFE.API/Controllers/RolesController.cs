using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PFE.Infrastructure.Data;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public RolesController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var roles = await _context.Roles
            .Where(r => r.Id == 1 || r.Id == 2 || r.Id == 3)
            .Select(r => new
            {
                id = r.Id,
                name = r.Name,
                description = r.Description
            })
            .ToListAsync();

        return Ok(roles);
    }
}
