using AutoMapper;
using Microsoft.EntityFrameworkCore;
using PFE.Application.DTOs.Profile;
using PFE.Application.DTOs.User;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class ProfileService : IProfileService
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public ProfileService(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<ProfileDto?> GetUserProfileAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return null;
        }

        var userDto = _mapper.Map<UserDto>(user);

        // Fetch all history items
        var historyItems = new List<HistoryItemDto>();

        // Seat Reservations
        var seatReservations = await _context.SeatReservations
            .Include(sr => sr.Seat)
                .ThenInclude(s => s.OfficeTable)
            .Where(sr => sr.UserId == userId)
            .OrderByDescending(sr => sr.CreatedAt)
            .ToListAsync();

        foreach (var sr in seatReservations)
        {
            historyItems.Add(new HistoryItemDto
            {
                Type = "SeatReservation",
                Id = sr.Id,
                Title = $"Seat {sr.Seat.Label} - {sr.Seat.OfficeTable.Name}",
                Status = sr.Status.ToString(),
                CreatedAt = sr.CreatedAt
            });
        }

        // Room Reservations
        var roomReservations = await _context.RoomReservations
            .Include(rr => rr.Room)
            .Where(rr => rr.UserId == userId)
            .OrderByDescending(rr => rr.CreatedAt)
            .ToListAsync();

        foreach (var rr in roomReservations)
        {
            historyItems.Add(new HistoryItemDto
            {
                Type = "RoomReservation",
                Id = rr.Id,
                Title = $"Room {rr.Room.Name}",
                Status = rr.Status.ToString(),
                CreatedAt = rr.CreatedAt
            });
        }

        // Leave Requests
        var leaveRequests = await _context.LeaveRequests
            .Where(lr => lr.UserId == userId)
            .OrderByDescending(lr => lr.CreatedAt)
            .ToListAsync();

        foreach (var lr in leaveRequests)
        {
            historyItems.Add(new HistoryItemDto
            {
                Type = "LeaveRequest",
                Id = lr.Id,
                Title = $"Leave Request - {lr.Type}",
                Status = lr.Status.ToString(),
                CreatedAt = lr.CreatedAt
            });
        }

        // Absence Requests
        var absenceRequests = await _context.AbsenceRequests
            .Where(ar => ar.UserId == userId)
            .OrderByDescending(ar => ar.CreatedAt)
            .ToListAsync();

        foreach (var ar in absenceRequests)
        {
            historyItems.Add(new HistoryItemDto
            {
                Type = "AbsenceRequest",
                Id = ar.Id,
                Title = "Absence Request",
                Status = ar.Status.ToString(),
                CreatedAt = ar.CreatedAt
            });
        }

        // General Requests
        var generalRequests = await _context.GeneralRequests
            .Where(gr => gr.UserId == userId)
            .OrderByDescending(gr => gr.CreatedAt)
            .ToListAsync();

        foreach (var gr in generalRequests)
        {
            historyItems.Add(new HistoryItemDto
            {
                Type = "GeneralRequest",
                Id = gr.Id,
                Title = gr.Title,
                Status = gr.Status.ToString(),
                CreatedAt = gr.CreatedAt
            });
        }

        // Sort all history items by CreatedAt descending
        historyItems = historyItems.OrderByDescending(h => h.CreatedAt).ToList();

        return new ProfileDto
        {
            User = userDto,
            History = historyItems
        };
    }
}
