namespace PFE.Domain.Entities;

public class DepartmentChannelReadState
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public DateTime? LastReadAt { get; set; }
}