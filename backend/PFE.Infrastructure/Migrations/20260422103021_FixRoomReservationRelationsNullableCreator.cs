using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixRoomReservationRelationsNullableCreator : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RoomReservations_Users_ManagerId",
                table: "RoomReservations");

            migrationBuilder.AddColumn<string>(
                name: "QrData",
                table: "Rooms",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "CreatedById",
                table: "RoomReservations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndedAt",
                table: "RoomReservations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EndedById",
                table: "RoomReservations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartedAt",
                table: "RoomReservations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StartedById",
                table: "RoomReservations",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoomReservations_CreatedById",
                table: "RoomReservations",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_RoomReservations_EndedById",
                table: "RoomReservations",
                column: "EndedById");

            migrationBuilder.CreateIndex(
                name: "IX_RoomReservations_StartedById",
                table: "RoomReservations",
                column: "StartedById");

            migrationBuilder.AddForeignKey(
                name: "FK_RoomReservations_Users_CreatedById",
                table: "RoomReservations",
                column: "CreatedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RoomReservations_Users_EndedById",
                table: "RoomReservations",
                column: "EndedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RoomReservations_Users_ManagerId",
                table: "RoomReservations",
                column: "ManagerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RoomReservations_Users_StartedById",
                table: "RoomReservations",
                column: "StartedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RoomReservations_Users_CreatedById",
                table: "RoomReservations");

            migrationBuilder.DropForeignKey(
                name: "FK_RoomReservations_Users_EndedById",
                table: "RoomReservations");

            migrationBuilder.DropForeignKey(
                name: "FK_RoomReservations_Users_ManagerId",
                table: "RoomReservations");

            migrationBuilder.DropForeignKey(
                name: "FK_RoomReservations_Users_StartedById",
                table: "RoomReservations");

            migrationBuilder.DropIndex(
                name: "IX_RoomReservations_CreatedById",
                table: "RoomReservations");

            migrationBuilder.DropIndex(
                name: "IX_RoomReservations_EndedById",
                table: "RoomReservations");

            migrationBuilder.DropIndex(
                name: "IX_RoomReservations_StartedById",
                table: "RoomReservations");

            migrationBuilder.DropColumn(
                name: "QrData",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "RoomReservations");

            migrationBuilder.DropColumn(
                name: "EndedAt",
                table: "RoomReservations");

            migrationBuilder.DropColumn(
                name: "EndedById",
                table: "RoomReservations");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "RoomReservations");

            migrationBuilder.DropColumn(
                name: "StartedById",
                table: "RoomReservations");

            migrationBuilder.AddForeignKey(
                name: "FK_RoomReservations_Users_ManagerId",
                table: "RoomReservations",
                column: "ManagerId",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
