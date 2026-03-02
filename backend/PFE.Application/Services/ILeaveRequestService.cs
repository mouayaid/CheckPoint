using PFE.Application.DTOs.Leave;

namespace PFE.Application.Services;

public interface ILeaveRequestService
{
    Task<LeaveRequestDto?> CreateLeaveRequestAsync(int userId, CreateLeaveRequestDto dto);
    Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId);
    Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForTeamAsync(int managerId);
}

