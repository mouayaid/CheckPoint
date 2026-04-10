using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSeatReservationIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SeatReservations_Seat_Date_Unique",
                table: "SeatReservations");

            migrationBuilder.DropIndex(
                name: "IX_SeatReservations_User_Date_Unique",
                table: "SeatReservations");

            migrationBuilder.CreateIndex(
                name: "IX_SeatReservations_Seat_Date_Unique",
                table: "SeatReservations",
                columns: new[] { "SeatId", "Date" },
                unique: true,
                filter: "[Status] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_SeatReservations_User_Date_Unique",
                table: "SeatReservations",
                columns: new[] { "UserId", "Date" },
                unique: true,
                filter: "[Status] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SeatReservations_Seat_Date_Unique",
                table: "SeatReservations");

            migrationBuilder.DropIndex(
                name: "IX_SeatReservations_User_Date_Unique",
                table: "SeatReservations");

            migrationBuilder.CreateIndex(
                name: "IX_SeatReservations_Seat_Date_Unique",
                table: "SeatReservations",
                columns: new[] { "SeatId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeatReservations_User_Date_Unique",
                table: "SeatReservations",
                columns: new[] { "UserId", "Date" },
                unique: true);
        }
    }
}
