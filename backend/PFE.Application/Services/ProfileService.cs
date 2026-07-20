using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PFE.Application.Common.Exceptions;
using PFE.Application.DTOs.Profile;
using PFE.Application.Abstractions;
using System.Text.RegularExpressions;

namespace PFE.Application.Services;

public class ProfileService : IProfileService
{
    private const int MaxNamePartLength = 100;
    private static readonly Regex PhoneRegex = new(@"^[0-9+\s().-]{6,20}$", RegexOptions.Compiled);

    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly CloudinaryService _cloudinaryService;
    private readonly ILogger<ProfileService> _logger;

    public ProfileService(
        IApplicationDbContext context,
        IMapper mapper,
        CloudinaryService cloudinaryService,
        ILogger<ProfileService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cloudinaryService = cloudinaryService;
        _logger = logger;
    }

    public async Task<ProfileDto?> GetUserProfileAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
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

    public async Task<ProfileDto?> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto)
    {
        var firstName = (dto.FirstName ?? string.Empty).Trim();
        var lastName = (dto.LastName ?? string.Empty).Trim();
        var phoneNumber = string.IsNullOrWhiteSpace(dto.PhoneNumber)
            ? null
            : dto.PhoneNumber.Trim();

        ValidateProfileInput(firstName, lastName, phoneNumber);

        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return null;

        CloudinaryImageUploadResult? uploadedImage = null;
        var oldProfileImagePublicId = user.ProfileImagePublicId;

        if (dto.ProfileImage != null && dto.ProfileImage.Length > 0)
        {
            uploadedImage = await _cloudinaryService.UploadProfileImageAsync(dto.ProfileImage);
        }

        user.FullName = $"{firstName} {lastName}";
        user.PhoneNumber = phoneNumber;

        if (uploadedImage != null)
        {
            user.ProfileImageUrl = uploadedImage.SecureUrl;
            user.ProfileImagePublicId = uploadedImage.PublicId;
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch
        {
            if (uploadedImage != null)
            {
                try
                {
                    await _cloudinaryService.DeleteImageAsync(uploadedImage.PublicId);
                }
                catch (Exception cleanupException)
                {
                    _logger.LogWarning(
                        cleanupException,
                        "Failed to delete unused profile image after profile save failure for user {UserId}.",
                        userId);
                }
            }

            throw;
        }

        if (uploadedImage != null && !string.IsNullOrWhiteSpace(oldProfileImagePublicId))
        {
            try
            {
                await _cloudinaryService.DeleteImageAsync(oldProfileImagePublicId);
            }
            catch (Exception cleanupException)
            {
                _logger.LogWarning(
                    cleanupException,
                    "Failed to delete replaced profile image for user {UserId}.",
                    userId);
            }
        }

        var userDto = _mapper.Map<PFE.Application.DTOs.User.UserDto>(user);

        return new ProfileDto
        {
            User = userDto,
            History = new List<HistoryItemDto>()
        };
    }

    private static void ValidateProfileInput(string firstName, string lastName, string? phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(firstName))
            throw new BadRequestException("First name is required.");

        if (string.IsNullOrWhiteSpace(lastName))
            throw new BadRequestException("Last name is required.");

        if (firstName.Length > MaxNamePartLength)
            throw new BadRequestException("First name is too long.");

        if (lastName.Length > MaxNamePartLength)
            throw new BadRequestException("Last name is too long.");

        if ($"{firstName} {lastName}".Length > 200)
            throw new BadRequestException("Full name is too long.");

        if (!string.IsNullOrWhiteSpace(phoneNumber) && !PhoneRegex.IsMatch(phoneNumber))
            throw new BadRequestException("Phone number format is invalid.");
    }
}
