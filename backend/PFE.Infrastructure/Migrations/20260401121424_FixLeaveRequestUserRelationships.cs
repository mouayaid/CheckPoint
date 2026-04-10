using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixLeaveRequestUserRelationships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LeaveRequests_Users_UserId1",
                table: "LeaveRequests");

            migrationBuilder.DropIndex(
                name: "IX_LeaveRequests_UserId1",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "UserId1",
                table: "LeaveRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId1",
                table: "LeaveRequests",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_UserId1",
                table: "LeaveRequests",
                column: "UserId1");

            migrationBuilder.AddForeignKey(
                name: "FK_LeaveRequests_Users_UserId1",
                table: "LeaveRequests",
                column: "UserId1",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
