using PFE.Application.DTOs.InternalRequest;

namespace PFE.Application.Services;

public interface IInternalRequestService
{
    Task<InternalRequestDto?> CreateRequestAsync(int userId, CreateInternalRequestDto dto);
    Task<List<InternalRequestDto>> GetUserRequestsAsync(int userId);
    Task<List<InternalRequestDto>> GetRequestsByCategoryAsync(string category);
    Task<InternalRequestDto?> UpdateRequestStatusAsync(int requestId, string status, string? comment, int? assignedToId);
}

