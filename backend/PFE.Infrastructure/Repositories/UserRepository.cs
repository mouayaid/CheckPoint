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
        // Role is enum, but method receives string -> parse safely.
        if (!Enum.TryParse<Role>(role, ignoreCase: true, out var parsedRole))
            return Enumerable.Empty<User>();

        // No IsActive in User entity -> remove that filter
        return await _dbSet
            .Where(u => u.Role == parsedRole)
            .ToListAsync();
    }
}
