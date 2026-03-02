using PFE.Application.DTOs.Leave;

namespace PFE.Application.Services;

public interface ILeaveService
{
    Task<LeaveRequestDto?> CreateLeaveRequestAsync(int userId, CreateLeaveRequestDto dto);
    Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId);
    Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForManagerAsync(int managerId);
    Task<bool> ReviewLeaveRequestAsync(int requestId, int managerId, ReviewLeaveRequestDto dto);
}

