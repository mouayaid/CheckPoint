using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Auth;
using PFE.Application.DTOs.User;
using PFE.Domain.Entities;
using PFE.Application.Abstractions;
using System.Security.Cryptography;
using System.Text;
using PFE.Application.Common;
using PFE.Application.Common.Exceptions;

namespace PFE.Application.Services;

public class AuthService : IAuthService
{
    private const int MaxResetOtpAttempts = 5;
    private const int MinPasswordLength = 8;
    private const int ResetOtpCooldownSeconds = 60;
    private const int MaxResetOtpRequestsPerWindow = 5;
    private static readonly TimeSpan ResetOtpThrottleWindow = TimeSpan.FromMinutes(15);

    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IMapper _mapper;

    private readonly IEmailService _emailService;

    public AuthService(
    IApplicationDbContext context,
    IJwtService jwtService,
    IMapper mapper,
    IEmailService emailService)
    {
        _context = context;
        _jwtService = jwtService;
        _mapper = mapper;
        _emailService = emailService;
    }

    private static string HashToken(string token)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto loginDto)
    {
        loginDto.Email = NormalizeEmail(loginDto.Email);
        ValidateRequired(loginDto.Email, "Email is required.");
        ValidateRequired(loginDto.Password, "Password is required.");

        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == loginDto.Email);

        if (user == null) return null;

        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            throw new Exception("PasswordHash is empty for this user.");

        bool isPasswordValid;

        try
        {
            isPasswordValid = BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash);
        }
        catch
        {
            throw new Exception("Invalid PasswordHash in database. This user password is not correctly hashed.");
        }

        if (!isPasswordValid) return null;

        if (!user.IsActive || user.RejectedAt != null)
        {
            return new AuthResponseDto
            {
                Token = string.Empty,
                RefreshToken = string.Empty,
                User = null
            };
        }

        if (user.Role == null)
            throw new Exception("User role is missing.");

        if (!IsSupportedRole(user.Role.Name))
            throw new Exception("User role is not supported.");

        var token = _jwtService.GenerateToken(
    user.Id,
    user.Email,
    user.Role.Name,
    user.DepartmentId
);
        var refreshToken = _jwtService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(refreshToken),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        var userDto = _mapper.Map<UserDto>(user);

        return new AuthResponseDto
        {
            Token = token,
            RefreshToken = refreshToken,
            User = userDto
        };
    }

    public async Task<AuthResponseDto?> RefreshTokenAsync(string refreshToken)
    {
        var tokenHash = HashToken(refreshToken);

        var storedToken = await _context.RefreshTokens
            .Include(t => t.User)
                .ThenInclude(u => u.Role)
            .Include(t => t.User.Department)
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                !t.IsRevoked &&
                t.ExpiresAt > DateTime.UtcNow
            );

        if (storedToken == null) return null;

        storedToken.IsRevoked = true;

        var user = storedToken.User;

        if (user == null ||
            user.Role == null ||
            !user.IsActive ||
            user.RejectedAt != null ||
            !IsSupportedRole(user.Role.Name))
        {
            await _context.SaveChangesAsync();
            return null;
        }

        var newToken = _jwtService.GenerateToken(
    user.Id,
    user.Email,
    user.Role.Name,
    user.DepartmentId
);
        var newRefreshToken = _jwtService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(newRefreshToken),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        var userDto = _mapper.Map<UserDto>(user);

        return new AuthResponseDto
        {
            Token = newToken,
            RefreshToken = newRefreshToken,
            User = userDto
        };
    }

    public async Task<AuthResponseDto?> RegisterAsync(RegisterDto registerDto)
    {
        registerDto.Email = NormalizeEmail(registerDto.Email);
        registerDto.FullName = registerDto.FullName?.Trim() ?? string.Empty;
        ValidateRequired(registerDto.Email, "Email is required.");
        ValidateRequired(registerDto.FullName, "Full name is required.");
        ValidatePassword(registerDto.Password);

        if (await _context.Users.AnyAsync(u => u.Email == registerDto.Email))
            return null;

        var user = new User
        {
            Email = registerDto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(registerDto.Password),
            FullName = registerDto.FullName,
            RoleId = 1,
            DepartmentId = null,
            PhoneNumber = registerDto.PhoneNumber,
            LeaveBalance = null,
            IsActive = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return new AuthResponseDto
        {
            Token = string.Empty,
            RefreshToken = string.Empty,
            User = null
        };
    }

    public async Task<UserDto?> GetUserByIdAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return null;

        return _mapper.Map<UserDto>(user);
    }

    public async Task<bool> ForgotPasswordAsync(string email)
    {
        email = NormalizeEmail(email);
        ValidateRequired(email, "Email is required.");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return true;
        }

        var now = DateTime.UtcNow;
        var recentOtps = await _context.PasswordResetOtps
            .Where(o => o.Email == email && o.CreatedAt >= now.Subtract(ResetOtpThrottleWindow))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        if (recentOtps.Count >= MaxResetOtpRequestsPerWindow ||
            recentOtps.FirstOrDefault()?.CreatedAt > now.AddSeconds(-ResetOtpCooldownSeconds))
        {
            return true;
        }

        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

        var oldOtps = await _context.PasswordResetOtps
            .Where(o => o.Email == email && !o.IsUsed)
            .ToListAsync();

        foreach (var oldOtp in oldOtps)
        {
            oldOtp.IsUsed = true;
        }

        _context.PasswordResetOtps.Add(new PasswordResetOtp
        {
            Email = email,
            OtpCode = HashToken(otpCode),
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false,
            Attempts = 0,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await _emailService.SendAsync(new EmailMessage
        {
            To = email,
            Subject = "Password Reset OTP",
            Body = $@"
        <h2>Password Reset</h2>
        <p>Your OTP code is:</p>
        <h1>{otpCode}</h1>
        <p>This code expires in 5 minutes.</p>
    "
        });

        return true;
    }

    public async Task<bool> VerifyResetOtpAsync(string email, string otpCode)
    {
        return await ValidateResetOtpAsync(email, otpCode, consumeOnSuccess: false);
    }

    public async Task<bool> ResetPasswordAsync(string email, string otpCode, string newPassword)
    {
        email = NormalizeEmail(email);
        ValidateRequired(email, "Email is required.");
        ValidateOtpCode(otpCode);
        ValidatePassword(newPassword);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return false;
        }

        var otp = await ValidateResetOtpAsync(email, otpCode, consumeOnSuccess: true);

        if (!otp)
        {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

        var activeRefreshTokens = await _context.RefreshTokens
            .Where(token =>
                token.UserId == user.Id &&
                !token.IsRevoked &&
                token.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();

        foreach (var refreshToken in activeRefreshTokens)
        {
            refreshToken.IsRevoked = true;
        }

        await _context.SaveChangesAsync();

        return true;
    }

    private async Task<bool> ValidateResetOtpAsync(string email, string otpCode, bool consumeOnSuccess)
    {
        email = NormalizeEmail(email);
        ValidateRequired(email, "Email is required.");
        ValidateOtpCode(otpCode);

        var otp = await _context.PasswordResetOtps
            .Where(o => o.Email == email && !o.IsUsed)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (otp == null)
        {
            return false;
        }

        if (otp.ExpiresAt <= DateTime.UtcNow || otp.Attempts >= MaxResetOtpAttempts)
        {
            otp.IsUsed = true;
            await _context.SaveChangesAsync();
            return false;
        }

        if (otp.OtpCode != HashToken(otpCode))
        {
            otp.Attempts++;

            if (otp.Attempts >= MaxResetOtpAttempts)
            {
                otp.IsUsed = true;
            }

            await _context.SaveChangesAsync();
            return false;
        }

        if (consumeOnSuccess)
        {
            otp.IsUsed = true;
        }

        return true;
    }

    private static bool IsSupportedRole(string roleName)
    {
        return roleName is "Employee" or "Manager" or "Admin";
    }

    private static string NormalizeEmail(string email)
    {
        return email?.Trim().ToLowerInvariant() ?? string.Empty;
    }

    private static void ValidateRequired(string value, string message)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new BadRequestException(message);
    }

    private static void ValidatePassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinPasswordLength)
            throw new BadRequestException($"Password must be at least {MinPasswordLength} characters.");
    }

    private static void ValidateOtpCode(string otpCode)
    {
        if (string.IsNullOrWhiteSpace(otpCode) ||
            otpCode.Length != 6 ||
            !otpCode.All(char.IsDigit))
        {
            throw new BadRequestException("OTP code must contain 6 digits.");
        }
    }
}
