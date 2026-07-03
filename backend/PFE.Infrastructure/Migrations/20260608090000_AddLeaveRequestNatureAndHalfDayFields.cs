using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveRequestNatureAndHalfDayFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "LeaveBalance",
                table: "Users",
                type: "decimal(5,2)",
                nullable: true,
                comment: "Remaining leave days balance",
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true,
                oldComment: "Remaining leave days balance");

            migrationBuilder.AddColumn<int>(
                name: "DayPeriod",
                table: "LeaveRequests",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "FromTime",
                table: "LeaveRequests",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RequestedDays",
                table: "LeaveRequests",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "ToTime",
                table: "LeaveRequests",
                type: "time",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DayPeriod",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "FromTime",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "RequestedDays",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "ToTime",
                table: "LeaveRequests");

            migrationBuilder.AlterColumn<int>(
                name: "LeaveBalance",
                table: "Users",
                type: "int",
                nullable: true,
                comment: "Remaining leave days balance",
                oldClrType: typeof(decimal),
                oldType: "decimal(5,2)",
                oldNullable: true,
                oldComment: "Remaining leave days balance");
        }
    }
}
