using PFE.Application.DTOs.GeneralRequest;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public interface IGeneralRequestService
{
    Task<GeneralRequestDto?> CreateRequestAsync(int userId, CreateGeneralRequestDto dto);
    Task<List<GeneralRequestDto>> GetUserRequestsAsync(int userId);
    Task<List<GeneralRequestDto>> GetAllRequestsAsync(RequestStatus? status, RequestCategory? category);
    Task<GeneralRequestDto?> UpdateRequestStatusAsync(int requestId, int userId, UpdateGeneralRequestStatusDto dto);
    Task<GeneralRequestDto?> ApproveRequestAsync(int requestId, int adminId, string? comment);
    Task<GeneralRequestDto?> RejectRequestAsync(int requestId, int adminId, string? comment);
}

