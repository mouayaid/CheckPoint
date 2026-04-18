using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeatCheckInFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QrCodeValue",
                table: "Seats",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckedInAt",
                table: "SeatReservations",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QrCodeValue",
                table: "Seats");

            migrationBuilder.DropColumn(
                name: "CheckedInAt",
                table: "SeatReservations");
        }
    }
}
