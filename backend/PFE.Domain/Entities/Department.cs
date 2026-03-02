namespace PFE.Domain.Entities;

public class Department
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    
    // Navigation properties
    public ICollection<User> Users { get; set; } = new List<User>();
}

