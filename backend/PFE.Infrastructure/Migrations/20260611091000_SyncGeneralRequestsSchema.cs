using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PFE.Infrastructure.Data;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260611091000_SyncGeneralRequestsSchema")]
    public partial class SyncGeneralRequestsSchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF COL_LENGTH(N'[GeneralRequests]', N'AuthorizedDate') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [AuthorizedDate] date NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'StartTime') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [StartTime] time NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'EndTime') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [EndTime] time NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'TotalMinutes') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [TotalMinutes] int NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'Motif') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [Motif] nvarchar(600) NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'RequestType') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [RequestType] nvarchar(50) NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'RequestText') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [RequestText] nvarchar(2000) NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'DocumentType') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [DocumentType] nvarchar(100) NULL;

                IF COL_LENGTH(N'[GeneralRequests]', N'Subject') IS NULL
                    ALTER TABLE [GeneralRequests] ADD [Subject] nvarchar(200) NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF COL_LENGTH(N'[GeneralRequests]', N'Subject') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [Subject];

                IF COL_LENGTH(N'[GeneralRequests]', N'DocumentType') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [DocumentType];

                IF COL_LENGTH(N'[GeneralRequests]', N'RequestText') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [RequestText];

                IF COL_LENGTH(N'[GeneralRequests]', N'RequestType') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [RequestType];

                IF COL_LENGTH(N'[GeneralRequests]', N'Motif') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [Motif];

                IF COL_LENGTH(N'[GeneralRequests]', N'TotalMinutes') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [TotalMinutes];

                IF COL_LENGTH(N'[GeneralRequests]', N'EndTime') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [EndTime];

                IF COL_LENGTH(N'[GeneralRequests]', N'StartTime') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [StartTime];

                IF COL_LENGTH(N'[GeneralRequests]', N'AuthorizedDate') IS NOT NULL
                    ALTER TABLE [GeneralRequests] DROP COLUMN [AuthorizedDate];
                """);
        }
    }
}
