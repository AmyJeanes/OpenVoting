using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenVoting.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddDisqualificationMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DisqualifiedAt",
                table: "PollEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DisqualifiedByMemberId",
                table: "PollEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_DisqualifiedByMemberId",
                table: "PollEntries",
                column: "DisqualifiedByMemberId");

            migrationBuilder.AddForeignKey(
                name: "FK_PollEntries_CommunityMembers_DisqualifiedByMemberId",
                table: "PollEntries",
                column: "DisqualifiedByMemberId",
                principalTable: "CommunityMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PollEntries_CommunityMembers_DisqualifiedByMemberId",
                table: "PollEntries");

            migrationBuilder.DropIndex(
                name: "IX_PollEntries_DisqualifiedByMemberId",
                table: "PollEntries");

            migrationBuilder.DropColumn(
                name: "DisqualifiedAt",
                table: "PollEntries");

            migrationBuilder.DropColumn(
                name: "DisqualifiedByMemberId",
                table: "PollEntries");
        }
    }
}
