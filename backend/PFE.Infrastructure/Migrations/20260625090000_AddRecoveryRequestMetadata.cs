using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    [Migration("20260625090000_AddRecoveryRequestMetadata")]
    public partial class AddRecoveryRequestMetadata : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecoveryPermutationType",
                table: "GeneralRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryNature",
                table: "GeneralRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequiredRecoveryMinutes",
                table: "GeneralRequests",
                type: "int",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecoveryPermutationType",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "RecoveryNature",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "RequiredRecoveryMinutes",
                table: "GeneralRequests");
        }
    }
}
