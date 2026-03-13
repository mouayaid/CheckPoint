using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddManagerReviewFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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

            migrationBuilder.AddColumn<string>(
                name: "ManagerComment",
                table: "AbsenceRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "AbsenceRequests",
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
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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

            migrationBuilder.DropColumn(
                name: "ManagerComment",
                table: "AbsenceRequests");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "AbsenceRequests");
        }
    }
}
