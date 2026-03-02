using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserApprovalSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add IsActive column with default false
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Add ApprovedAt column (nullable datetime2)
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            // Add ApprovedByUserId column (nullable int)
            migrationBuilder.AddColumn<int>(
                name: "ApprovedByUserId",
                table: "Users",
                type: "int",
                nullable: true);

            // Make LeaveBalance nullable
            migrationBuilder.AlterColumn<int>(
                name: "LeaveBalance",
                table: "Users",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: false,
                oldDefaultValue: 0,
                oldComment: "Remaining leave days balance");

            // Set IsActive = true for existing users to avoid breaking current logins
            migrationBuilder.Sql("UPDATE Users SET IsActive = 1 WHERE IsActive = 0 OR IsActive IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert LeaveBalance to non-nullable
            migrationBuilder.AlterColumn<int>(
                name: "LeaveBalance",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0,
                comment: "Remaining leave days balance",
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            // Remove columns
            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Users");
        }
    }
}
