using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserYearlySalary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "YearlySalary",
                table: "Users",
                type: "decimal(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "YearlySalary",
                table: "Users");
        }
    }
}
