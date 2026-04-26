using PFE.Application.DTOs.OfficeTable;
using PFE.Application.DTOs.Seat;

namespace PFE.Application.DTOs.Layout;

public class AdminOfficeLayoutDto
{
    public List<OfficeTableDto> Tables { get; set; } = new();
    public List<SeatDto> Seats { get; set; } = new();
}