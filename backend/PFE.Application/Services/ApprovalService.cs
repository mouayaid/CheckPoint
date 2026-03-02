using Microsoft.EntityFrameworkCore;
using PFE.Domain.Enums;
using PFE.Application.Abstractions;

namespace PFE.Application.Services;

public class ApprovalService : IApprovalService
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public ApprovalService(IApplicationDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<bool> ApproveLeaveRequestAsync(int requestId, int managerId, string? comment)
    {
        var request = await _context.LeaveRequests
            .Include(l => l.User)
                .ThenInclude(u => u.Department)
            .Include(l => l.Manager)
            .FirstOrDefaultAsync(l => l.Id == requestId);

        if (request == null || request.Status != RequestStatus.Pending)
        {
            return false;
        }

        // Check if manager can approve (same department or Admin)
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null || (manager.Role != Role.Admin && manager.DepartmentId != request.User.DepartmentId))
        {
            return false; // Manager not authorized
        }

        request.Status = RequestStatus.Approved;
        request.ManagerId = managerId;
        // Note: LeaveRequest doesn't have ManagerComment field, but we can add it if needed

        await _context.SaveChangesAsync();

        // Create notification for employee
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Leave Request Approved",
            $"Your leave request from {request.StartDate:yyyy-MM-dd} to {request.EndDate:yyyy-MM-dd} has been approved.{(string.IsNullOrEmpty(comment) ? "" : $" Comment: {comment}")}",
            "Success",
            "LeaveRequest",
            request.Id);

        return true;
    }

    public async Task<bool> RejectLeaveRequestAsync(int requestId, int managerId, string? comment)
    {
        var request = await _context.LeaveRequests
            .Include(l => l.User)
                .ThenInclude(u => u.Department)
            .Include(l => l.Manager)
            .FirstOrDefaultAsync(l => l.Id == requestId);

        if (request == null || request.Status != RequestStatus.Pending)
        {
            return false;
        }

        // Check if manager can approve (same department or Admin)
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null || (manager.Role != Role.Admin && manager.DepartmentId != request.User.DepartmentId))
        {
            return false; // Manager not authorized
        }

        request.Status = RequestStatus.Rejected;
        request.ManagerId = managerId;

        await _context.SaveChangesAsync();

        // Create notification for employee
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Leave Request Rejected",
            $"Your leave request from {request.StartDate:yyyy-MM-dd} to {request.EndDate:yyyy-MM-dd} has been rejected.{(string.IsNullOrEmpty(comment) ? "" : $" Reason: {comment}")}",
            "Warning",
            "LeaveRequest",
            request.Id);

        return true;
    }

    public async Task<bool> ApproveAbsenceRequestAsync(int requestId, int managerId, string? comment)
    {
        var request = await _context.AbsenceRequests
            .Include(a => a.User)
                .ThenInclude(u => u.Department)
            .Include(a => a.Manager)
            .FirstOrDefaultAsync(a => a.Id == requestId);

        if (request == null || request.Status != RequestStatus.Pending)
        {
            return false;
        }

        // Check if manager can approve (same department or Admin)
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null || (manager.Role != Role.Admin && manager.DepartmentId != request.User.DepartmentId))
        {
            return false; // Manager not authorized
        }

        request.Status = RequestStatus.Approved;
        request.ManagerId = managerId;

        await _context.SaveChangesAsync();

        // Create notification for employee
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Absence Request Approved",
            $"Your absence request for {request.Date:yyyy-MM-dd} has been approved.{(string.IsNullOrEmpty(comment) ? "" : $" Comment: {comment}")}",
            "Success",
            "AbsenceRequest",
            request.Id);

        return true;
    }

    public async Task<bool> RejectAbsenceRequestAsync(int requestId, int managerId, string? comment)
    {
        var request = await _context.AbsenceRequests
            .Include(a => a.User)
                .ThenInclude(u => u.Department)
            .Include(a => a.Manager)
            .FirstOrDefaultAsync(a => a.Id == requestId);

        if (request == null || request.Status != RequestStatus.Pending)
        {
            return false;
        }

        // Check if manager can approve (same department or Admin)
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null || (manager.Role != Role.Admin && manager.DepartmentId != request.User.DepartmentId))
        {
            return false; // Manager not authorized
        }

        request.Status = RequestStatus.Rejected;
        request.ManagerId = managerId;

        await _context.SaveChangesAsync();

        // Create notification for employee
        await _notificationService.CreateNotificationAsync(
            request.UserId,
            "Absence Request Rejected",
            $"Your absence request for {request.Date:yyyy-MM-dd} has been rejected.{(string.IsNullOrEmpty(comment) ? "" : $" Reason: {comment}")}",
            "Warning",
            "AbsenceRequest",
            request.Id);

        return true;
    }

    public async Task<bool> ApproveRoomReservationAsync(int reservationId, int managerId, string? comment)
    {
        var reservation = await _context.RoomReservations
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.Room)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null || reservation.Status != ReservationStatus.Pending)
        {
            return false;
        }

        // Check if manager can approve (same department or Admin)
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null || (manager.Role != Role.Admin && manager.DepartmentId != reservation.User.DepartmentId))
        {
            return false; // Manager not authorized
        }

        // Check for overlapping reservations before approving
        var overlapping = await _context.RoomReservations
            .AnyAsync(r => r.RoomId == reservation.RoomId &&
                          r.Id != reservationId &&
                          r.Status == ReservationStatus.Active &&
                          r.StartDateTime < reservation.EndDateTime &&
                          r.EndDateTime > reservation.StartDateTime);

        if (overlapping)
        {
            return false; // Time slot is now occupied
        }

        reservation.Status = ReservationStatus.Active;

        await _context.SaveChangesAsync();

        // Create notification for employee
        await _notificationService.CreateNotificationAsync(
            reservation.UserId,
            "Room Reservation Approved",
            $"Your room reservation for {reservation.Room.Name} from {reservation.StartDateTime:yyyy-MM-dd HH:mm} to {reservation.EndDateTime:yyyy-MM-dd HH:mm} has been approved.{(string.IsNullOrEmpty(comment) ? "" : $" Comment: {comment}")}",
            "Success",
            "RoomReservation",
            reservation.Id);

        return true;
    }

    public async Task<bool> RejectRoomReservationAsync(int reservationId, int managerId, string? comment)
    {
        var reservation = await _context.RoomReservations
            .Include(r => r.User)
                .ThenInclude(u => u.Department)
            .Include(r => r.Room)
            .FirstOrDefaultAsync(r => r.Id == reservationId);

        if (reservation == null || reservation.Status != ReservationStatus.Pending)
        {
            return false;
        }

        // Check if manager can approve (same department or Admin)
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null || (manager.Role != Role.Admin && manager.DepartmentId != reservation.User.DepartmentId))
        {
            return false; // Manager not authorized
        }

        reservation.Status = ReservationStatus.Cancelled;

        await _context.SaveChangesAsync();

        // Create notification for employee
        await _notificationService.CreateNotificationAsync(
            reservation.UserId,
            "Room Reservation Rejected",
            $"Your room reservation for {reservation.Room.Name} from {reservation.StartDateTime:yyyy-MM-dd HH:mm} to {reservation.EndDateTime:yyyy-MM-dd HH:mm} has been rejected.{(string.IsNullOrEmpty(comment) ? "" : $" Reason: {comment}")}",
            "Warning",
            "RoomReservation",
            reservation.Id);

        return true;
    }
}

