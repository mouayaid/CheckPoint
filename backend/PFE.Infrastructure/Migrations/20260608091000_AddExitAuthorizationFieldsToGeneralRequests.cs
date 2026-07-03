using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExitAuthorizationFieldsToGeneralRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AuthorizedDate",
                table: "GeneralRequests",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "EndTime",
                table: "GeneralRequests",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Motif",
                table: "GeneralRequests",
                type: "nvarchar(600)",
                maxLength: 600,
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "StartTime",
                table: "GeneralRequests",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalMinutes",
                table: "GeneralRequests",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AuthorizedDate",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "Motif",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "GeneralRequests");

            migrationBuilder.DropColumn(
                name: "TotalMinutes",
                table: "GeneralRequests");
        }
    }
}
