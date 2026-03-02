namespace PFE.Application.Services;

public interface IApprovalService
{
    Task<bool> ApproveLeaveRequestAsync(int requestId, int managerId, string? comment);
    Task<bool> ApproveAbsenceRequestAsync(int requestId, int managerId, string? comment);
    Task<bool> ApproveRoomReservationAsync(int reservationId, int managerId, string? comment);
    Task<bool> RejectLeaveRequestAsync(int requestId, int managerId, string? comment);
    Task<bool> RejectAbsenceRequestAsync(int requestId, int managerId, string? comment);
    Task<bool> RejectRoomReservationAsync(int reservationId, int managerId, string? comment);
}

