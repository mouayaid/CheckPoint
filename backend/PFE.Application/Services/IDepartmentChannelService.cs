using PFE.Application.DTOs.ChannelMessage;

namespace PFE.Application.Services;

public interface IDepartmentChannelService
{
    Task<DepartmentChannelMessageDto> CreateMessageAsync(int userId, CreateDepartmentMessageDto dto);
    Task<DepartmentChannelMessageDto> CreatePollAsync(int userId, CreateDepartmentPollDto dto);
    Task<List<DepartmentChannelMessageDto>> GetDepartmentFeedAsync(int userId, int departmentId);
    Task<List<DepartmentChannelMessageDto>> GetMyDepartmentFeedAsync(int userId);
    Task<DepartmentPollVotersDto> GetPollVotersAsync(int userId, int pollId);
    Task VotePollAsync(int userId, int pollId, VoteDepartmentPollDto dto);

    Task<MyDepartmentChannelDto> GetMyDepartmentChannelAsync(int userId);
    Task MarkDepartmentChannelAsReadAsync(int userId);
}
