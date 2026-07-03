using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRecoveryFieldsToGeneralRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecoverySlotsJson",
                table: "GeneralRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalRecoveryMinutes",
                table: "GeneralRequests",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecoverySlotsJson",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "TotalRecoveryMinutes",
                table: "GeneralRequests");
        }
    }
}
