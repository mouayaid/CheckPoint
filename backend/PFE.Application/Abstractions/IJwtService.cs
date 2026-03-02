using PFE.Domain.Enums;

namespace PFE.Application.Abstractions;

public interface IJwtService
{
    string GenerateToken(int userId, string email, Role role);
}
