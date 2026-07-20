using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PFE.Infrastructure.Migrations
{
    public partial class EnforceSingleDepartmentPollVotePerUser : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PollVotes_UniqueVote",
                table: "DepartmentPollVotes");

            migrationBuilder.Sql(
                """
                WITH RankedVotes AS
                (
                    SELECT
                        Id,
                        ROW_NUMBER() OVER (
                            PARTITION BY PollId, UserId
                            ORDER BY VotedAt ASC, Id ASC
                        ) AS VoteRank
                    FROM DepartmentPollVotes
                )
                DELETE FROM RankedVotes
                WHERE VoteRank > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_UniqueVote",
                table: "DepartmentPollVotes",
                columns: new[] { "PollId", "UserId" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PollVotes_UniqueVote",
                table: "DepartmentPollVotes");

            migrationBuilder.CreateIndex(
                name: "IX_PollVotes_UniqueVote",
                table: "DepartmentPollVotes",
                columns: new[] { "PollId", "UserId", "PollOptionId" },
                unique: true);
        }
    }
}
