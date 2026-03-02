using PFE.Domain.Entities;

namespace PFE.Infrastructure.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetSubordinatesAsync(int managerId);
    Task<IEnumerable<User>> GetUsersByRoleAsync(string role);
}

