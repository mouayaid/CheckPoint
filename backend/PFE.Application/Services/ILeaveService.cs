using PFE.Application.DTOs.Leave;

namespace PFE.Application.Services;

public interface ILeaveService
{
    Task<LeaveRequestDto> CreateLeaveRequestAsync(int userId, CreateLeaveRequestDto dto);
    Task<List<LeaveRequestDto>> GetUserLeaveRequestsAsync(int userId);

    Task<List<LeaveRequestDto>> GetPendingLeaveRequestsForReviewerAsync(int reviewerId);

    Task<LeaveRequestDto?> ApproveLeaveRequestAsync(
        int requestId,
        int reviewerId,
        ApproveLeaveRequestDto dto
    );

    Task<LeaveRequestDto?> RejectLeaveRequestAsync(
        int requestId,
        int reviewerId,
        RejectLeaveRequestDto dto
    );
}