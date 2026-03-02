using PFE.Application.DTOs.User;

namespace PFE.Application.DTOs.Profile;

public class ProfileDto
{
    public UserDto User { get; set; } = null!;
    public List<HistoryItemDto> History { get; set; } = new List<HistoryItemDto>();
}

