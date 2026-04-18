using Microsoft.EntityFrameworkCore;
using PFE.Application.Abstractions;
using PFE.Domain.Entities;
using PFE.Domain.Enums;

namespace PFE.Infrastructure.Data;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    // DbSets for all entities
    public DbSet<Department> Departments { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<OfficeTable> OfficeTables { get; set; }

    public DbSet<InternalRequest> InternalRequests { get; set; }
    

    public DbSet<Seat> Seats { get; set; }
    public DbSet<SeatReservation> SeatReservations { get; set; }
    public DbSet<Room> Rooms { get; set; }
    public DbSet<RoomReservation> RoomReservations { get; set; }
    public DbSet<LeaveRequest> LeaveRequests { get; set; }
    public DbSet<AbsenceRequest> AbsenceRequests { get; set; }
    public DbSet<GeneralRequest> GeneralRequests { get; set; }
    public DbSet<Event> Events { get; set; }
    public DbSet<EventParticipant> EventParticipants { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<Announcement> Announcements => Set<Announcement>();

    public DbSet<DepartmentChannelReadState> DepartmentChannelReadStates { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DepartmentChannelMessage>()
    .HasOne(m => m.Poll)
    .WithOne(p => p.Message)
    .HasForeignKey<DepartmentPoll>(p => p.MessageId);

        modelBuilder.Entity<DepartmentPollOption>()
        .HasOne(o => o.Poll)
        .WithMany(p => p.Options)
        .HasForeignKey(o => o.PollId);

        modelBuilder.Entity<DepartmentPollVote>()
            .HasOne(v => v.Poll)
            .WithMany(p => p.Votes)
            .HasForeignKey(v => v.PollId);

        ConfigureDepartment(modelBuilder);
        ConfigureUser(modelBuilder);
        ConfigureOfficeTable(modelBuilder);
        ConfigureSeat(modelBuilder);
        ConfigureSeatReservation(modelBuilder);
        ConfigureRoom(modelBuilder);
        ConfigureRoomReservation(modelBuilder);
        ConfigureLeaveRequest(modelBuilder);
        ConfigureAbsenceRequest(modelBuilder);
        ConfigureGeneralRequest(modelBuilder);
        ConfigureEvent(modelBuilder);
        ConfigureEventParticipant(modelBuilder);
        ConfigureNotification(modelBuilder);
        ConfigureDepartmentChannelMessage(modelBuilder);
        ConfigureDepartmentPoll(modelBuilder);
        ConfigureDepartmentPollOption(modelBuilder);
        ConfigureDepartmentPollVote(modelBuilder);
    }

    private void ConfigureDepartment(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.Name)
                .IsUnique()
                .HasDatabaseName("IX_Departments_Name");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);

            // One-to-Many: Department -> Users
            entity.HasMany(e => e.Users)
                .WithOne(e => e.Department)
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Users_Department");
        });
    }
    private void ConfigureDepartmentChannelMessage(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DepartmentChannelMessage>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Content)
                .HasMaxLength(2000);

            entity.Property(e => e.MessageType)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.DepartmentId)
                .HasDatabaseName("IX_ChannelMessages_DepartmentId");

            // Department → Messages
            entity.HasOne(e => e.Department)
                .WithMany(d => d.ChannelMessages)
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // User → Messages
            entity.HasOne(e => e.Sender)
                .WithMany(u => u.SentDepartmentMessages)
                .HasForeignKey(e => e.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            // Message → Poll (1-1)
            entity.HasOne(e => e.Poll)
                .WithOne(p => p.Message)
                .HasForeignKey<DepartmentPoll>(p => p.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
    private void ConfigureDepartmentPoll(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DepartmentPoll>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Question)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasMany(e => e.Options)
                .WithOne(o => o.Poll)
                .HasForeignKey(o => o.PollId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Votes)
                .WithOne(v => v.Poll)
                .HasForeignKey(v => v.PollId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
    private void ConfigureDepartmentPollOption(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DepartmentPollOption>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Text)
                .IsRequired()
                .HasMaxLength(300);

            entity.HasMany(e => e.Votes)
                .WithOne(v => v.PollOption)
                .HasForeignKey(v => v.PollOptionId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
    private void ConfigureDepartmentPollVote(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DepartmentPollVote>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.VotedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.User)
                .WithMany(u => u.DepartmentPollVotes)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.PollId, e.UserId, e.PollOptionId })
                .IsUnique()
                .HasDatabaseName("IX_PollVotes_UniqueVote");
        });
    }

    private void ConfigureUser(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.Email)
                .IsUnique()
                .HasDatabaseName("IX_Users_Email");

            entity.HasIndex(e => e.DepartmentId)
                .HasDatabaseName("IX_Users_DepartmentId");

            entity.HasIndex(e => e.Role)
                .HasDatabaseName("IX_Users_Role");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.FullName)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Email)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(e => e.PasswordHash)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.Role)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(Role.Employee);

            entity.Property(e => e.DepartmentId)
                .IsRequired();

            entity.Property(e => e.LeaveBalance)
                .HasComment("Remaining leave days balance");

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(e => e.ApprovedAt)
                .HasColumnType("datetime2");

            entity.Property(e => e.ApprovedByUserId);

            // Relationships
            entity.HasOne(e => e.Department)
                .WithMany(e => e.Users)
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Users_Department");
        });
    }

    private void ConfigureOfficeTable(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<OfficeTable>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.PositionX)
                .IsRequired()
                .HasComment("X coordinate in 2D layout");

            entity.Property(e => e.PositionY)
                .IsRequired()
                .HasComment("Y coordinate in 2D layout");

            entity.Property(e => e.Width)
                .IsRequired()
                .HasDefaultValue(100)
                .HasComment("Table width in pixels/units");

            entity.Property(e => e.Height)
                .IsRequired()
                .HasDefaultValue(50)
                .HasComment("Table height in pixels/units");

            // One-to-Many: OfficeTable -> Seats
            entity.HasMany(e => e.Seats)
                .WithOne(e => e.OfficeTable)
                .HasForeignKey(e => e.OfficeTableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Seats_OfficeTable");
        });
    }

    private void ConfigureSeat(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Seat>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.OfficeTableId)
                .HasDatabaseName("IX_Seats_OfficeTableId");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.OfficeTableId)
                .IsRequired();

            entity.Property(e => e.PositionX)
                .IsRequired()
                .HasComment("X coordinate relative to table");

            entity.Property(e => e.PositionY)
                .IsRequired()
                .HasComment("Y coordinate relative to table");

            entity.Property(e => e.Label)
                .IsRequired()
                .HasMaxLength(50)
                .HasComment("Seat label/identifier (e.g., A1, B2)");

            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            // Relationships
            entity.HasOne(e => e.OfficeTable)
                .WithMany(e => e.Seats)
                .HasForeignKey(e => e.OfficeTableId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Seats_OfficeTable");

            entity.HasMany(e => e.Reservations)
                .WithOne(e => e.Seat)
                .HasForeignKey(e => e.SeatId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SeatReservations_Seat");
        });
    }

    private void ConfigureSeatReservation(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SeatReservation>(entity =>
        {
            entity.HasKey(e => e.Id);

            // Unique constraint: Only one reservation per seat per date (Active only)
            entity.HasIndex(e => new { e.SeatId, e.Date })
                .IsUnique()
                .HasFilter("[Status] = 1")
                .HasDatabaseName("IX_SeatReservations_Seat_Date_Unique");

            // Unique constraint: Only one seat per user per date (Active only)
            entity.HasIndex(e => new { e.UserId, e.Date })
                .IsUnique()
                .HasFilter("[Status] = 1")
                .HasDatabaseName("IX_SeatReservations_User_Date_Unique");

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_SeatReservations_UserId");

            entity.HasIndex(e => e.Date)
                .HasDatabaseName("IX_SeatReservations_Date");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_SeatReservations_Status");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.SeatId)
                .IsRequired();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.Date)
                .IsRequired()
                .HasColumnType("date")
                .HasComment("Reservation date (date only)");

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(SeatReservationStatus.Active);

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            entity.HasOne(e => e.Seat)
                .WithMany(e => e.Reservations)
                .HasForeignKey(e => e.SeatId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SeatReservations_Seat");

            entity.HasOne(e => e.User)
                .WithMany(e => e.SeatReservations)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SeatReservations_User");
        });
    }

    private void ConfigureRoom(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Room>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.Name)
                .IsUnique()
                .HasDatabaseName("IX_Rooms_Name");

            entity.HasIndex(e => e.Type)
                .HasDatabaseName("IX_Rooms_Type");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Type)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.Capacity)
                .IsRequired()
                .HasDefaultValue(10)
                .HasComment("Maximum number of people");

            entity.Property(e => e.Location)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            // Relationships
            entity.HasMany(e => e.Reservations)
                .WithOne(e => e.Room)
                .HasForeignKey(e => e.RoomId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RoomReservations_Room");

            entity.HasMany(e => e.Events)
                .WithOne(e => e.Room)
                .HasForeignKey(e => e.RoomId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_Events_Room");
        });
    }

    private void ConfigureRoomReservation(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoomReservation>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.RoomId)
                .HasDatabaseName("IX_RoomReservations_RoomId");

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_RoomReservations_UserId");

            entity.HasIndex(e => new { e.RoomId, e.StartDateTime, e.EndDateTime })
                .HasDatabaseName("IX_RoomReservations_Room_TimeRange");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_RoomReservations_Status");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.RoomId)
                .IsRequired();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.StartDateTime)
                .IsRequired()
                .HasColumnType("datetime2");

            entity.Property(e => e.EndDateTime)
                .IsRequired()
                .HasColumnType("datetime2");

            entity.Property(e => e.Status)
    .IsRequired()
    .HasConversion<int>()
    .ValueGeneratedNever();

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            entity.HasOne(e => e.Room)
                .WithMany(e => e.Reservations)
                .HasForeignKey(e => e.RoomId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RoomReservations_Room");

            entity.HasOne(e => e.User)
                .WithMany(e => e.RoomReservations)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RoomReservations_User");

            // Check constraint: EndDateTime > StartDateTime
            entity.ToTable(t => t.HasCheckConstraint(
                "CK_RoomReservations_EndDateTime_After_StartDateTime",
                "[EndDateTime] > [StartDateTime]"));
        });
    }

    private void ConfigureLeaveRequest(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LeaveRequest>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Reason)
                .IsRequired()
                .HasMaxLength(1000);

            entity.Property(e => e.ManagerComment)
                .HasMaxLength(1000);

            entity.Property(e => e.ReviewedAt)
                .HasColumnType("datetime2");

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_LeaveRequests_UserId");

            entity.HasIndex(e => e.AssignedManagerId)
                .HasDatabaseName("IX_LeaveRequests_AssignedManagerId");

            entity.HasIndex(e => e.ReviewedById)
                .HasDatabaseName("IX_LeaveRequests_ReviewedById");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_LeaveRequests_Status");

            entity.HasIndex(e => new { e.UserId, e.StartDate, e.EndDate })
                .HasDatabaseName("IX_LeaveRequests_User_DateRange");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.StartDate)
                .IsRequired()
                .HasColumnType("date");

            entity.Property(e => e.EndDate)
                .IsRequired()
                .HasColumnType("date");

            entity.Property(e => e.Type)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(RequestStatus.Pending);

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships

            entity.HasOne(e => e.User)
    .WithMany(u => u.LeaveRequests)
    .HasForeignKey(e => e.UserId)
    .OnDelete(DeleteBehavior.Cascade)
    .HasConstraintName("FK_LeaveRequests_User");

            entity.HasOne(e => e.AssignedManager)
                .WithMany(u => u.ManagedLeaveRequests)
                .HasForeignKey(e => e.AssignedManagerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_LeaveRequests_AssignedManager");

            entity.HasOne(e => e.ReviewedBy)
                .WithMany()
                .HasForeignKey(e => e.ReviewedById)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_LeaveRequests_ReviewedBy");

            // Check constraint
            entity.ToTable(t => t.HasCheckConstraint(
                "CK_LeaveRequests_EndDate_After_StartDate",
                "[EndDate] >= [StartDate]"));
        });
    }

    private void ConfigureAbsenceRequest(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AbsenceRequest>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_AbsenceRequests_UserId");

            entity.HasIndex(e => e.ManagerId)
                .HasDatabaseName("IX_AbsenceRequests_ManagerId");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_AbsenceRequests_Status");

            entity.HasIndex(e => new { e.UserId, e.Date })
                .HasDatabaseName("IX_AbsenceRequests_User_Date");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.Date)
                .IsRequired()
                .HasColumnType("date");

            entity.Property(e => e.Reason)
                .IsRequired()
                .HasMaxLength(1000);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(RequestStatus.Pending);

            entity.Property(e => e.ManagerId)
                .HasComment("Manager who will review this request");

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            entity.HasOne(e => e.User)
                .WithMany(e => e.AbsenceRequests)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_AbsenceRequests_User");

            entity.HasOne(e => e.Manager)
                .WithMany(e => e.ManagedAbsenceRequests)
                .HasForeignKey(e => e.ManagerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_AbsenceRequests_Manager");
        });
    }

    private void ConfigureGeneralRequest(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GeneralRequest>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_GeneralRequests_UserId");

            entity.HasIndex(e => e.Category)
                .HasDatabaseName("IX_GeneralRequests_Category");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_GeneralRequests_Status");

            entity.HasIndex(e => e.AssignedToUserId)
                .HasDatabaseName("IX_GeneralRequests_AssignedToUserId");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Description)
                .IsRequired()
                .HasMaxLength(2000);

            entity.Property(e => e.Category)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(RequestStatus.Pending);

            entity.Property(e => e.AssignedToUserId)
                .HasComment("User assigned to handle this request");

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            entity.HasOne(e => e.User)
                .WithMany(e => e.GeneralRequests)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_GeneralRequests_User");

            entity.HasOne(e => e.AssignedToUser)
                .WithMany(e => e.AssignedGeneralRequests)
                .HasForeignKey(e => e.AssignedToUserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_GeneralRequests_AssignedToUser");
        });
    }

    private void ConfigureEvent(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Event>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.RoomId)
                .HasDatabaseName("IX_Events_RoomId");

            entity.HasIndex(e => e.CreatedByUserId)
                .HasDatabaseName("IX_Events_CreatedByUserId");

            entity.HasIndex(e => new { e.StartDateTime, e.EndDateTime })
                .HasDatabaseName("IX_Events_DateTimeRange");

            entity.HasIndex(e => e.Type)
                .HasDatabaseName("IX_Events_Type");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Description)
                .HasMaxLength(2000);

            entity.Property(e => e.Type)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.RoomId)
                .HasComment("Optional room where event takes place");

            entity.Property(e => e.StartDateTime)
                .IsRequired()
                .HasColumnType("datetime2");

            entity.Property(e => e.EndDateTime)
                .IsRequired()
                .HasColumnType("datetime2");

            entity.Property(e => e.CreatedByUserId)
                .IsRequired();

            entity.Property(e => e.IsMandatory)
                .IsRequired()
                .HasDefaultValue(false)
                .HasComment("Whether attendance is mandatory");

            entity.Property(e => e.RSVPEnabled)
                .IsRequired()
                .HasDefaultValue(true)
                .HasComment("Whether RSVP is enabled for this event");

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            entity.HasOne(e => e.Room)
                .WithMany(e => e.Events)
                .HasForeignKey(e => e.RoomId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_Events_Room");

            entity.HasOne(e => e.CreatedByUser)
                .WithMany(e => e.CreatedEvents)
                .HasForeignKey(e => e.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Events_CreatedByUser");

            entity.HasMany(e => e.Participants)
                .WithOne(e => e.Event)
                .HasForeignKey(e => e.EventId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EventParticipants_Event");

            // Check constraint: EndDateTime > StartDateTime
            entity.ToTable(t => t.HasCheckConstraint(
                "CK_Events_EndDateTime_After_StartDateTime",
                "[EndDateTime] > [StartDateTime]"));
        });
    }

    private void ConfigureEventParticipant(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EventParticipant>(entity =>
        {
            entity.HasKey(e => e.Id);

            // Unique constraint: One participant record per event-user combination
            entity.HasIndex(e => new { e.EventId, e.UserId })
                .IsUnique()
                .HasDatabaseName("IX_EventParticipants_Event_User_Unique");

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_EventParticipants_UserId");

            entity.HasIndex(e => e.Status)
                .HasDatabaseName("IX_EventParticipants_Status");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.EventId)
                .IsRequired();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>()
                .HasDefaultValue(ParticipantStatus.Pending);

            entity.Property(e => e.ResponseAt)
                .HasColumnType("datetime2")
                .HasComment("When user responded to the event invitation");

            // Relationships
            entity.HasOne(e => e.Event)
                .WithMany(e => e.Participants)
                .HasForeignKey(e => e.EventId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EventParticipants_Event");

            entity.HasOne(e => e.User)
                .WithMany(e => e.EventParticipants)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_EventParticipants_User");
        });
    }
    public DbSet<DepartmentChannelMessage> DepartmentChannelMessages => Set<DepartmentChannelMessage>();
    public DbSet<DepartmentPoll> DepartmentPolls => Set<DepartmentPoll>();
    public DbSet<DepartmentPollOption> DepartmentPollOptions => Set<DepartmentPollOption>();
    public DbSet<DepartmentPollVote> DepartmentPollVotes => Set<DepartmentPollVote>();
    private void ConfigureNotification(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_Notifications_UserId");

            entity.HasIndex(e => new { e.UserId, e.IsRead })
                .HasDatabaseName("IX_Notifications_User_IsRead");

            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("IX_Notifications_CreatedAt");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Message)
                .IsRequired()
                .HasMaxLength(1000);

            entity.Property(e => e.Type)
                .IsRequired()
                .HasMaxLength(50)
                .HasDefaultValue("Info");

            entity.Property(e => e.RelatedEntityType)
                .HasMaxLength(50);

            entity.Property(e => e.RelatedEntityId);

            entity.Property(e => e.IsRead)
                .IsRequired()
                .HasDefaultValue(false);

            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            entity.HasOne(e => e.User)
                .WithMany(e => e.Notifications)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_Notifications_User");
        });
    }
}