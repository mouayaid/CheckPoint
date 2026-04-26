using PFE.Application.DTOs.Layout;
using PFE.Application.DTOs.OfficeTable;
using PFE.Application.DTOs.Seat;

namespace PFE.Application.Services;

public class OfficeLayoutService : IOfficeLayoutService
{
    private readonly IOfficeTableService _tableService;
    private readonly ISeatService _seatService;

    public OfficeLayoutService(
        IOfficeTableService tableService,
        ISeatService seatService)
    {
        _tableService = tableService;
        _seatService = seatService;
    }

    public async Task<AdminOfficeLayoutDto> GetAdminOfficeLayoutAsync()
    {
        var tables = await _tableService.GetAllOfficeTablesAsync();
        var seats = await _seatService.GetAllSeatsAsync();

        return new AdminOfficeLayoutDto
        {
            Tables = tables,
            Seats = seats
        };
    }
}