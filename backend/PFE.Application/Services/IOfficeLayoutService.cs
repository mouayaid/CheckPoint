using PFE.Application.DTOs.Layout;

namespace PFE.Application.Services;

public interface IOfficeLayoutService
{
    Task<AdminOfficeLayoutDto> GetAdminOfficeLayoutAsync();
}