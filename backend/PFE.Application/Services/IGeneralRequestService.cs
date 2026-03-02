using PFE.Application.DTOs.GeneralRequest;
using PFE.Domain.Enums;

namespace PFE.Application.Services;

public interface IGeneralRequestService
{
    Task<GeneralRequestDto?> CreateRequestAsync(int userId, CreateGeneralRequestDto dto);
    Task<List<GeneralRequestDto>> GetUserRequestsAsync(int userId);
    Task<List<GeneralRequestDto>> GetAllRequestsAsync(RequestStatus? status, RequestCategory? category);
    Task<GeneralRequestDto?> AssignRequestAsync(int requestId, int adminId, AssignGeneralRequestDto dto);
    Task<GeneralRequestDto?> UpdateRequestStatusAsync(int requestId, int userId, UpdateGeneralRequestStatusDto dto);
}

