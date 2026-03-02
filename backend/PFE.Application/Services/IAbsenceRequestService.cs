using PFE.Application.DTOs.AbsenceRequest;

namespace PFE.Application.Services;

public interface IAbsenceRequestService
{
    Task<AbsenceRequestDto?> CreateAbsenceRequestAsync(int userId, CreateAbsenceRequestDto dto);
    Task<List<AbsenceRequestDto>> GetUserAbsenceRequestsAsync(int userId);
    Task<List<AbsenceRequestDto>> GetPendingAbsenceRequestsForTeamAsync(int managerId);
}

