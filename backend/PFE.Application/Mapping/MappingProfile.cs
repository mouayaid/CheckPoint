using AutoMapper;
using PFE.Application.DTOs.AbsenceRequest;
using PFE.Application.DTOs.Department;
using PFE.Application.DTOs.Event;
using PFE.Application.DTOs.EventParticipant;
using PFE.Application.DTOs.GeneralRequest;
using PFE.Application.DTOs.Notification;
using PFE.Application.DTOs.OfficeTable;
using PFE.Application.DTOs.Room;
using PFE.Application.DTOs.RoomReservation;
using PFE.Application.DTOs.Seat;
using PFE.Application.DTOs.SeatReservation;
using PFE.Application.DTOs.User;
using PFE.Domain.Entities;
using PFE.Domain.Enums;
using PFE.Application.DTOs.Leave;

namespace PFE.Application.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Department mappings
        CreateMap<Department, DepartmentDto>()
            .ForMember(dest => dest.UserCount, opt => opt.MapFrom(src => src.Users.Count));
        CreateMap<CreateDepartmentDto, Department>();
        CreateMap<UpdateDepartmentDto, Department>();

        // User mappings
        CreateMap<User, UserDto>()
    .ForMember(dest => dest.DepartmentName, opt => opt.MapFrom(src => src.Department.Name))
    .ForMember(dest => dest.LeaveBalance, opt => opt.MapFrom(src => src.LeaveBalance));
        CreateMap<CreateUserDto, User>()
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Department, opt => opt.Ignore());

        CreateMap<UpdateUserDto, User>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Email, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Department, opt => opt.Ignore());

        // OfficeTable mappings
        CreateMap<OfficeTable, OfficeTableDto>()
            .ForMember(dest => dest.SeatCount, opt => opt.MapFrom(src => src.Seats.Count));

        CreateMap<CreateOfficeTableDto, OfficeTable>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Seats, opt => opt.Ignore());

        CreateMap<UpdateOfficeTableDto, OfficeTable>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Seats, opt => opt.Ignore());

        // Seat mappings
        CreateMap<Seat, SeatDto>()
            .ForMember(dest => dest.OfficeTableName, opt => opt.MapFrom(src => src.OfficeTable.Name));

        CreateMap<Seat, SeatMapResponseDto>()
            .ForMember(dest => dest.OfficeTableName, opt => opt.MapFrom(src => src.OfficeTable.Name))
            .ForMember(dest => dest.IsReserved, opt => opt.Ignore())
            .ForMember(dest => dest.ReservedByUserId, opt => opt.Ignore())
            .ForMember(dest => dest.ReservedByUserName, opt => opt.Ignore())
            .ForMember(dest => dest.ReservationDate, opt => opt.Ignore());

        CreateMap<CreateSeatDto, Seat>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OfficeTable, opt => opt.Ignore())
            .ForMember(dest => dest.Reservations, opt => opt.Ignore());

        CreateMap<UpdateSeatDto, Seat>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OfficeTableId, opt => opt.Ignore())
            .ForMember(dest => dest.OfficeTable, opt => opt.Ignore())
            .ForMember(dest => dest.Reservations, opt => opt.Ignore());

        // SeatReservation mappings
        CreateMap<SeatReservation, SeatReservationDto>()
            .ForMember(dest => dest.SeatLabel, opt => opt.MapFrom(src => src.Seat.Label))
            .ForMember(dest => dest.OfficeTableName, opt => opt.MapFrom(src => src.Seat.OfficeTable.Name))
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User.FullName));

        CreateMap<SeatReservationCreateDto, SeatReservation>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => ReservationStatus.Active))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.Seat, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());

        CreateMap<UpdateSeatReservationDto, SeatReservation>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.SeatId, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Date, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Seat, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());

        // Room mappings
        CreateMap<Room, RoomDto>();

        CreateMap<CreateRoomDto, Room>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Reservations, opt => opt.Ignore())
            .ForMember(dest => dest.Events, opt => opt.Ignore());

        CreateMap<UpdateRoomDto, Room>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Reservations, opt => opt.Ignore())
            .ForMember(dest => dest.Events, opt => opt.Ignore());

        // RoomReservation mappings
        CreateMap<RoomReservation, RoomReservationDto>()
            .ForMember(dest => dest.RoomName, opt => opt.MapFrom(src => src.Room != null ? src.Room.Name : ""))
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User != null ? src.User.FullName : ""));
        // Status maps automatically (enum → enum), no override needed ✅
        CreateMap<RoomReservation, RoomReservationForDayDto>()
            .ForMember(dest => dest.ReservedBy, opt => opt.MapFrom(src =>
                src.User == null ? null : new PFE.Application.DTOs.RoomReservation.ReservedByDto
                {
                    UserId = src.UserId,
                    FullName = src.User.FullName ?? string.Empty,
                    DepartmentName = src.User.Department != null
                        ? src.User.Department.Name
                        : string.Empty
                }
            ));

        CreateMap<CreateRoomReservationDto, RoomReservation>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Room, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());

        // LeaveRequest mappings
        CreateMap<LeaveRequest, LeaveRequestDto>()
            .ForMember(dest => dest.UserName,
                opt => opt.MapFrom(src => src.User.FullName))
            .ForMember(dest => dest.AssignedManagerName,
                opt => opt.MapFrom(src =>
                    src.AssignedManager != null
                        ? src.AssignedManager.FullName
                        : null))
            .ForMember(dest => dest.ReviewedByName,
                opt => opt.MapFrom(src =>
                    src.ReviewedBy != null
                        ? src.ReviewedBy.FullName
                        : null));

        CreateMap<CreateLeaveRequestDto, LeaveRequest>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => RequestStatus.Pending))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedManagerId, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedManager, opt => opt.Ignore())
            .ForMember(dest => dest.ReviewedById, opt => opt.Ignore())
            .ForMember(dest => dest.ReviewedBy, opt => opt.Ignore());

        CreateMap<UpdateLeaveRequestDto, LeaveRequest>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedManagerId, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedManager, opt => opt.Ignore())
            .ForMember(dest => dest.ReviewedById, opt => opt.Ignore())
            .ForMember(dest => dest.ReviewedBy, opt => opt.Ignore());

        // AbsenceRequest mappings
        CreateMap<AbsenceRequest, AbsenceRequestDto>()
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User.FullName))
            .ForMember(dest => dest.ManagerName, opt => opt.MapFrom(src => src.Manager != null ? src.Manager.FullName : null));

        CreateMap<CreateAbsenceRequestDto, AbsenceRequest>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => RequestStatus.Pending))
            .ForMember(dest => dest.ManagerId, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.Manager, opt => opt.Ignore());

        CreateMap<UpdateAbsenceRequestDto, AbsenceRequest>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.Ignore())
            .ForMember(dest => dest.ManagerId, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.Manager, opt => opt.Ignore());

        // GeneralRequest mappings
        CreateMap<GeneralRequest, GeneralRequestDto>()
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User.FullName))
            .ForMember(dest => dest.AssignedToUserName, opt => opt.MapFrom(src => src.AssignedToUser != null ? src.AssignedToUser.FullName : null));

        CreateMap<CreateGeneralRequestDto, GeneralRequest>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => RequestStatus.Pending))
            .ForMember(dest => dest.AssignedToUserId, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedToUser, opt => opt.Ignore());

        CreateMap<UpdateGeneralRequestDto, GeneralRequest>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedToUserId, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedToUser, opt => opt.Ignore());

        // Event mappings
        CreateMap<Event, EventDto>()
            .ForMember(dest => dest.RoomName, opt => opt.MapFrom(src => src.Room != null ? src.Room.Name : null))
            .ForMember(dest => dest.CreatedByUserName, opt => opt.MapFrom(src => src.CreatedByUser.FullName))
            .ForMember(dest => dest.ParticipantCount, opt => opt.MapFrom(src => src.Participants.Count));

        CreateMap<CreateEventDto, Event>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedByUserId, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.Room, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedByUser, opt => opt.Ignore())
            .ForMember(dest => dest.Participants, opt => opt.Ignore());

        CreateMap<UpdateEventDto, Event>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedByUserId, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Room, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedByUser, opt => opt.Ignore())
            .ForMember(dest => dest.Participants, opt => opt.Ignore());

        // EventParticipant mappings
        CreateMap<EventParticipant, EventParticipantDto>()
            .ForMember(dest => dest.EventTitle, opt => opt.MapFrom(src => src.Event.Title))
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.User.FullName));

        CreateMap<CreateEventParticipantDto, EventParticipant>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.ResponseAt, opt => opt.Ignore())
            .ForMember(dest => dest.Event, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());

        CreateMap<UpdateEventParticipantDto, EventParticipant>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.EventId, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.ResponseAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.Event, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());

        // Notification mappings
        CreateMap<Notification, NotificationDto>();

        CreateMap<CreateNotificationDto, Notification>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.IsRead, opt => opt.MapFrom(src => false))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.User, opt => opt.Ignore());

        CreateMap<UpdateNotificationDto, Notification>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.Title, opt => opt.Ignore())
            .ForMember(dest => dest.Message, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());
    }
}