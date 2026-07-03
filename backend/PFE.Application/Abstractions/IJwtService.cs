namespace PFE.Application.Abstractions;

public interface IJwtService
{
    string GenerateToken(int userId, string email, string role, int? departmentId);
    string GenerateRefreshToken();
}
