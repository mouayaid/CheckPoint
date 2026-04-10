using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Profile;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class ProfileService : IProfileService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public ProfileService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<ProfileDto?> GetUserProfileAsync(int userId)
    {
        try
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return null;

            var userDto = _mapper.Map<PFE.Application.DTOs.User.UserDto>(user);

            return new ProfileDto
            {
                User = userDto,
                History = new List<HistoryItemDto>()
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine("PROFILE ERROR:");
            Console.WriteLine(ex.ToString());
            throw;
        }
    }
}