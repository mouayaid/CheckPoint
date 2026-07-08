using PFE.Application.DTOs.Admin;

namespace PFE.Application.Services;

public interface IAdminChatbotService
{
    Task<AdminStatisticsChatResponseDto> AnswerAsync(AdminStatisticsChatRequestDto request);
}
