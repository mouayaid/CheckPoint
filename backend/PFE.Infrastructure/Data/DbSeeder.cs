using Microsoft.EntityFrameworkCore;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using BCrypt.Net;

namespace PFE.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        await context.Database.MigrateAsync();

        // Seed Departments
        if (!await context.Departments.AnyAsync())
        {
            var departments = new List<Department>
            {
                new Department { Name = "IT" },
                new Department { Name = "People Operations" },
                new Department { Name = "Finance" },
                new Department { Name = "Operations" }
            };

            await context.Departments.AddRangeAsync(departments);
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

            foreach (var seat in seats)
                seat.QrCodeValue = $"SEAT:{seat.Id}";

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
                    IsActive = true
                },
                new Room
                {
                    Name = "Meeting Room B",
                    Type = RoomType.Meeting,
                    Capacity = 10,
                    IsActive = true
                },
                new Room
                {
                    Name = "Training Room",
                    Type = RoomType.Training,
                    Capacity = 30,
                    IsActive = true
                }
            };

            await context.Rooms.AddRangeAsync(rooms);
            await context.SaveChangesAsync();
        }
    }
}

