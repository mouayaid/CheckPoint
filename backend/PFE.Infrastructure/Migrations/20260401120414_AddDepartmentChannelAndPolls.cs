using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDepartmentChannelAndPolls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_Manager",
                table: "LeaveRequests");

            migrationBuilder.DropTable(
                name: "DeskReservations");

            migrationBuilder.DropTable(
                name: "Desks");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_ManagerId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ManagerId",
                table: "LeaveRequests");

            migrationBuilder.AddColumn<int>(
                name: "AssignedManagerId",
                table: "LeaveRequests",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewedById",
                table: "LeaveRequests",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UserId1",
                table: "LeaveRequests",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DepartmentChannelMessages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    SenderId = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    MessageType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IsPinned = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentChannelMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepartmentChannelMessages_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DepartmentChannelMessages_Users_SenderId",
                        column: x => x.SenderId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DepartmentPolls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MessageId = table.Column<int>(type: "int", nullable: false),
                    Question = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AllowMultipleChoices = table.Column<bool>(type: "bit", nullable: false),
                    IsClosed = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentPolls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepartmentPolls_DepartmentChannelMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "DepartmentChannelMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DepartmentPollOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PollId = table.Column<int>(type: "int", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentPollOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepartmentPollOptions_DepartmentPolls_PollId",
                        column: x => x.PollId,
                        principalTable: "DepartmentPolls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DepartmentPollVotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PollId = table.Column<int>(type: "int", nullable: false),
                    PollOptionId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    VotedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentPollVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepartmentPollVotes_DepartmentPollOptions_PollOptionId",
                        column: x => x.PollOptionId,
                        principalTable: "DepartmentPollOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DepartmentPollVotes_DepartmentPolls_PollId",
                        column: x => x.PollId,
                        principalTable: "DepartmentPolls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DepartmentPollVotes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_AssignedManagerId",
                table: "LeaveRequests",
                column: "AssignedManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_ReviewedById",
                table: "LeaveRequests",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_UserId1",
                table: "LeaveRequests",
                column: "UserId1");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelMessages_DepartmentId",
                table: "DepartmentChannelMessages",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentChannelMessages_SenderId",
                table: "DepartmentChannelMessages",
                column: "SenderId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentPollOptions_PollId",
                table: "DepartmentPollOptions",
                column: "PollId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentPolls_MessageId",
                table: "DepartmentPolls",
                column: "MessageId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentPollVotes_PollOptionId",
                table: "DepartmentPollVotes",
                column: "PollOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentPollVotes_UserId",
                table: "DepartmentPollVotes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_UniqueVote",
                table: "DepartmentPollVotes",
                columns: new[] { "PollId", "UserId", "PollOptionId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_AssignedManager",
                table: "LeaveRequests",
                column: "AssignedManagerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_ReviewedBy",
                table: "LeaveRequests",
                column: "ReviewedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_Users_UserId1",
                table: "LeaveRequests",
                column: "UserId1",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_AssignedManager",
                table: "LeaveRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_ReviewedBy",
                table: "LeaveRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_Users_UserId1",
                table: "LeaveRequests");

            migrationBuilder.DropTable(
                name: "DepartmentPollVotes");

            migrationBuilder.DropTable(
                name: "DepartmentPollOptions");

            migrationBuilder.DropTable(
                name: "DepartmentPolls");

            migrationBuilder.DropTable(
                name: "DepartmentChannelMessages");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_AssignedManagerId",
                table: "LeaveRequests");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_ReviewedById",
                table: "LeaveRequests");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_UserId1",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "AssignedManagerId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ReviewedById",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "LeaveRequests");

            migrationBuilder.AddColumn<int>(
                name: "ManagerId",
                table: "LeaveRequests",
                type: "int",
                nullable: true,
                comment: "Manager who will review this request");

            migrationBuilder.CreateTable(
                name: "Desks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsAvailable = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    X = table.Column<int>(type: "int", nullable: false),
                    Y = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Desks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeskReservations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DeskId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReservationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeskReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeskReservations_Desks_DeskId",
                        column: x => x.DeskId,
                        principalTable: "Desks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DeskReservations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_ManagerId",
                table: "LeaveRequests",
                column: "ManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_DeskReservations_DeskId",
                table: "DeskReservations",
                column: "DeskId");

            migrationBuilder.CreateIndex(
                name: "IX_DeskReservations_UserId",
                table: "DeskReservations",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_Manager",
                table: "LeaveRequests",
                column: "ManagerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
