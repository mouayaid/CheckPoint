using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDocumentUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DocumentUrl",
                table: "AbsenceRequests");

            migrationBuilder.DropColumn(
                name: "DocumentUrl",
                table: "LeaveRequests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DocumentUrl",
                table: "AbsenceRequests",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                comment: "URL to uploaded document (if any)");

            migrationBuilder.AddColumn<string>(
                name: "DocumentUrl",
                table: "LeaveRequests",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                comment: "URL to uploaded document (if any)");
        }
    }
}
