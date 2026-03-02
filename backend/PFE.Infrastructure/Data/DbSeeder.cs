using Microsoft.EntityFrameworkCore;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using BCrypt.Net;

namespace PFE.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Ensure database is created
        await context.Database.EnsureCreatedAsync();

        // Seed Departments
        if (!await context.Departments.AnyAsync())
        {
            var departments = new List<Department>
            {
                new Department { Name = "IT" },
                new Department { Name = "HR" },
                new Department { Name = "Finance" },
                new Department { Name = "Operations" }
            };

            await context.Departments.AddRangeAsync(departments);
            await context.SaveChangesAsync();
        }

        // Seed Users (Admin, Manager, Employee)
        if (!await context.Users.AnyAsync())
        {
            var departments = await context.Departments.ToListAsync();
            var itDepartment = departments.FirstOrDefault(d => d.Name == "IT") 
                ?? departments.First();

            var users = new List<User>
            {
                // Admin User
                new User
                {
                    Email = "admin@pfe.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                    FullName = "Admin User",
                    Role = Role.Admin,
                    DepartmentId = itDepartment.Id,
                    LeaveBalance = 25,
                    CreatedAt = DateTime.UtcNow
                },
                // Manager User
                new User
                {
                    Email = "manager@pfe.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Manager123!"),
                    FullName = "Manager User",
                    Role = Role.Manager,
                    DepartmentId = itDepartment.Id,
                    LeaveBalance = 20,
                    CreatedAt = DateTime.UtcNow
                },
                // Employee User
                new User
                {
                    Email = "employee@pfe.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Employee123!"),
                    FullName = "Employee User",
                    Role = Role.Employee,
                    DepartmentId = itDepartment.Id,
                    LeaveBalance = 15,
                    CreatedAt = DateTime.UtcNow
                },
                // Additional Employee
                new User
                {
                    Email = "john.doe@pfe.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
                    FullName = "John Doe",
                    Role = Role.Employee,
                    DepartmentId = itDepartment.Id,
                    LeaveBalance = 18,
                    CreatedAt = DateTime.UtcNow
                }
            };

            await context.Users.AddRangeAsync(users);
            await context.SaveChangesAsync();
        }

        // Seed Office Tables and Seats (optional - for testing)
        if (!await context.OfficeTables.AnyAsync())
        {
            var officeTables = new List<OfficeTable>
            {
                new OfficeTable
                {
                    Name = "Table 1",
                    PositionX = 100,
                    PositionY = 100,
                    Width = 200,
                    Height = 100
                },
                new OfficeTable
                {
                    Name = "Table 2",
                    PositionX = 350,
                    PositionY = 100,
                    Width = 200,
                    Height = 100
                }
            };

            await context.OfficeTables.AddRangeAsync(officeTables);
            await context.SaveChangesAsync();

            // Add seats to tables
            var table1 = officeTables[0];
            var table2 = officeTables[1];

            var seats = new List<Seat>
            {
                new Seat { OfficeTableId = table1.Id, PositionX = 10, PositionY = 10, Label = "A1", IsActive = true },
                new Seat { OfficeTableId = table1.Id, PositionX = 60, PositionY = 10, Label = "A2", IsActive = true },
                new Seat { OfficeTableId = table1.Id, PositionX = 110, PositionY = 10, Label = "A3", IsActive = true },
                new Seat { OfficeTableId = table2.Id, PositionX = 10, PositionY = 10, Label = "B1", IsActive = true },
                new Seat { OfficeTableId = table2.Id, PositionX = 60, PositionY = 10, Label = "B2", IsActive = true }
            };

            await context.Seats.AddRangeAsync(seats);
            await context.SaveChangesAsync();
        }

        // Seed Rooms (optional - for testing)
        if (!await context.Rooms.AnyAsync())
        {
            var rooms = new List<Room>
            {
                new Room
                {
                    Name = "Conference Room A",
                    Type = RoomType.Conference,
                    Capacity = 20,
                    Location = "Main floor",
                    IsActive = true
                },
                new Room
                {
                    Name = "Meeting Room B",
                    Type = RoomType.Meeting,
                    Capacity = 10,
                    Location = "Main floor",
                    IsActive = true
                },
                new Room
                {
                    Name = "Training Room",
                    Type = RoomType.Training,
                    Capacity = 30,
                    Location = "Main floor",
                    IsActive = true
                }
            };

            await context.Rooms.AddRangeAsync(rooms);
            await context.SaveChangesAsync();
        }
    }
}

