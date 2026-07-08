using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PFE.Infrastructure.Data;

#nullable disable

namespace PFE.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260706141000_RemoveRoomReservationApprovalLifecycle")]
public partial class RemoveRoomReservationApprovalLifecycle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Preserve the established numeric values for live statuses and normalize
        // legacy approval-workflow rows before the enum members are removed.
        migrationBuilder.Sql("UPDATE [RoomReservations] SET [Status] = 1 WHERE [Status] = 0;");
        migrationBuilder.Sql("UPDATE [RoomReservations] SET [Status] = 2 WHERE [Status] = 4;");

        migrationBuilder.DropForeignKey(
            name: "FK_RoomReservations_Users_ManagerId",
            table: "RoomReservations");

        migrationBuilder.DropIndex(
            name: "IX_RoomReservations_ManagerId",
            table: "RoomReservations");

        migrationBuilder.DropColumn(
            name: "ManagerComment",
            table: "RoomReservations");

        migrationBuilder.DropColumn(
            name: "ManagerId",
            table: "RoomReservations");

        migrationBuilder.DropColumn(
            name: "ReviewedAt",
            table: "RoomReservations");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ManagerComment",
            table: "RoomReservations",
            type: "nvarchar(max)",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "ManagerId",
            table: "RoomReservations",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "ReviewedAt",
            table: "RoomReservations",
            type: "datetime2",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_RoomReservations_ManagerId",
            table: "RoomReservations",
            column: "ManagerId");

        migrationBuilder.AddForeignKey(
            name: "FK_RoomReservations_Users_ManagerId",
            table: "RoomReservations",
            column: "ManagerId",
            principalTable: "Users",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }
}
