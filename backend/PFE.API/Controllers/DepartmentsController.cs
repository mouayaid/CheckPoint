using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Common;
using PFE.Application.DTOs.Department;
using PFE.Domain.Entities;
using PFE.Infrastructure.Data;

namespace PFE.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DepartmentsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var departments = await _context.Departments
            .OrderBy(d => d.Id)
            .Select(d => new
            {
                id = d.Id,
                name = d.Name
            })
            .ToListAsync();

        return Ok(departments);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetById(int id)
    {
        var department = await _context.Departments
            .Where(d => d.Id == id)
            .Select(d => new DepartmentDto { Id = d.Id, Name = d.Name })
            .SingleOrDefaultAsync();

        return department == null
            ? NotFound(ApiResponse<DepartmentDto>.ErrorResponse("Département introuvable."))
            : Ok(ApiResponse<DepartmentDto>.SuccessResponse(department));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateDepartmentDto dto)
    {
        var name = dto.Name?.Trim() ?? string.Empty;
        var validationResult = await ValidateNameAsync(name);
        if (validationResult != null)
            return validationResult;

        var department = new Department { Name = name };
        _context.Departments.Add(department);
        await _context.SaveChangesAsync();

        var result = new DepartmentDto { Id = department.Id, Name = department.Name };
        return CreatedAtAction(
            nameof(GetById),
            new { id = department.Id },
            ApiResponse<DepartmentDto>.SuccessResponse(result, "Département créé."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDepartmentDto dto)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
            return NotFound(ApiResponse<DepartmentDto>.ErrorResponse("Département introuvable."));

        var name = dto.Name?.Trim() ?? string.Empty;
        var validationResult = await ValidateNameAsync(name, id);
        if (validationResult != null)
            return validationResult;

        department.Name = name;
        await _context.SaveChangesAsync();

        var result = new DepartmentDto { Id = department.Id, Name = department.Name };
        return Ok(ApiResponse<DepartmentDto>.SuccessResponse(result, "Département modifié."));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
            return NotFound(ApiResponse<object>.ErrorResponse("Département introuvable."));

        if (await _context.Users.AnyAsync(user => user.DepartmentId == id))
        {
            return Conflict(ApiResponse<object>.ErrorResponse(
                "Ce département contient des utilisateurs. Réaffectez-les avant de le supprimer."));
        }

        var hasChannelData = await _context.DepartmentChannelMessages
            .AnyAsync(message => message.DepartmentId == id)
            || await _context.DepartmentChannelReadStates
                .AnyAsync(state => state.DepartmentId == id);

        if (hasChannelData)
        {
            return Conflict(ApiResponse<object>.ErrorResponse(
                "Ce département contient un historique de communication et ne peut pas être supprimé."));
        }

        _context.Departments.Remove(department);
        await _context.SaveChangesAsync();
        return Ok(ApiResponse<object>.SuccessResponse(null, "Département supprimé."));
    }

    private async Task<IActionResult?> ValidateNameAsync(string name, int? excludedId = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(ApiResponse<object>.ErrorResponse("Le nom du département est obligatoire."));

        if (name.Length > 100)
            return BadRequest(ApiResponse<object>.ErrorResponse("Le nom du département ne peut pas dépasser 100 caractères."));

        var normalizedName = name.ToLower();
        var duplicateExists = await _context.Departments.AnyAsync(department =>
            department.Name.ToLower() == normalizedName
            && (!excludedId.HasValue || department.Id != excludedId.Value));

        return duplicateExists
            ? Conflict(ApiResponse<object>.ErrorResponse("Un département portant ce nom existe déjà."))
            : null;
    }
}
