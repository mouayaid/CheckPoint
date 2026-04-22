using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Application.DTOs.OfficeTable;
using PFE.Domain.Entities;

namespace PFE.Application.Services;

public class OfficeTableService : IOfficeTableService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public OfficeTableService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<List<OfficeTableDto>> GetAllOfficeTablesAsync()
    {
        var tables = await _context.OfficeTables
            .Include(t => t.Seats)
            .ToListAsync();
        return _mapper.Map<List<OfficeTableDto>>(tables);
    }

    public async Task<OfficeTableDto?> GetOfficeTableByIdAsync(int id)
    {
        var table = await _context.OfficeTables
            .Include(t => t.Seats)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (table == null) return null;
        return _mapper.Map<OfficeTableDto>(table);
    }

    public async Task<OfficeTableDto> CreateOfficeTableAsync(CreateOfficeTableDto dto)
    {
        var table = _mapper.Map<OfficeTable>(dto);
        _context.OfficeTables.Add(table);
        await _context.SaveChangesAsync();
        return _mapper.Map<OfficeTableDto>(table);
    }

    public async Task<OfficeTableDto?> UpdateOfficeTableAsync(int id, UpdateOfficeTableDto dto)
    {
        var table = await _context.OfficeTables
            .Include(t => t.Seats)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (table == null) return null;

        _mapper.Map(dto, table);
        _context.OfficeTables.Update(table);
        await _context.SaveChangesAsync();

        return _mapper.Map<OfficeTableDto>(table);
    }

    public async Task<bool> DeleteOfficeTableAsync(int id)
    {
        var table = await _context.OfficeTables.FindAsync(id);
        if (table == null) return false;

        _context.OfficeTables.Remove(table);
        await _context.SaveChangesAsync();
        return true;
    }
}
