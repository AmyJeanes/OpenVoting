using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenVoting.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddOneTimeLoginLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OneTimeLoginTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CommunityMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneTimeLoginTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneTimeLoginTokens_CommunityMembers_CommunityMemberId",
                        column: x => x.CommunityMemberId,
                        principalTable: "CommunityMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeLoginTokens_CommunityMemberId_UsedAt_RevokedAt_Expir~",
                table: "OneTimeLoginTokens",
                columns: new[] { "CommunityMemberId", "UsedAt", "RevokedAt", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeLoginTokens_ExpiresAt",
                table: "OneTimeLoginTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_OneTimeLoginTokens_TokenHash",
                table: "OneTimeLoginTokens",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OneTimeLoginTokens");
        }
    }
}
