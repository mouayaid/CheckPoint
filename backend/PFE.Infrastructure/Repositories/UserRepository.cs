using Microsoft.EntityFrameworkCore;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Infrastructure.Data;

namespace PFE.Infrastructure.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        // No Manager navigation in User entity -> remove Include(u => u.Manager)
        return await _dbSet.FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<IEnumerable<User>> GetSubordinatesAsync(int managerId)
    {
        // Your User entity has no ManagerId -> we can't query subordinates.
        // Returning empty list keeps the app compiling until you implement manager hierarchy.
        return Enumerable.Empty<User>();
    }

  public async Task<IEnumerable<User>> GetUsersByRoleAsync(string role)
{
    if (string.IsNullOrWhiteSpace(role))
        return new List<User>();

    role = role.Trim().ToLower();

    return await _dbSet
        .Include(u => u.Role)
        .Where(u => u.Role.Name.ToLower() == role)
        .ToListAsync();
}
}
