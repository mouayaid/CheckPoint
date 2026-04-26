using PFE.Application.DTOs.OfficeTable;

namespace PFE.Application.Services;
using PFE.Application.DTOs.Layout;

public interface IOfficeTableService
{
    Task<List<OfficeTableDto>> GetAllOfficeTablesAsync();
    Task<OfficeTableDto?> GetOfficeTableByIdAsync(int id);
    Task<OfficeTableDto> CreateOfficeTableAsync(CreateOfficeTableDto dto);
    Task<OfficeTableDto?> UpdateOfficeTableAsync(int id, UpdateOfficeTableDto dto);
    Task<bool> DeleteOfficeTableAsync(int id);

    Task<OfficeTableDto?> UpdateOfficeTablePositionAsync(int id, UpdatePositionDto dto);
}
