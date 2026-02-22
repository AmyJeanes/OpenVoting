using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenVoting.Server.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceTeaserAssetWithBlurHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
                        migrationBuilder.AddColumn<string>(
                                name: "TeaserBlurHash",
                                table: "PollEntries",
                                type: "text",
                                nullable: true);

                        migrationBuilder.Sql(@"
                                UPDATE ""PollEntries""
                                SET ""TeaserBlurHash"" = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'
                                WHERE ""TeaserBlurHash"" IS NULL
                                    AND (
                                        ""TeaserAssetId"" IS NOT NULL
                                        OR ""OriginalAssetId"" IS NOT NULL
                                        OR ""PublicAssetId"" IS NOT NULL
                                    );
                        ");

            migrationBuilder.DropForeignKey(
                name: "FK_PollEntries_Assets_TeaserAssetId",
                table: "PollEntries");

            migrationBuilder.DropIndex(
                name: "IX_PollEntries_TeaserAssetId",
                table: "PollEntries");

            migrationBuilder.DropColumn(
                name: "TeaserAssetId",
                table: "PollEntries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TeaserBlurHash",
                table: "PollEntries");

            migrationBuilder.AddColumn<Guid>(
                name: "TeaserAssetId",
                table: "PollEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_TeaserAssetId",
                table: "PollEntries",
                column: "TeaserAssetId");

            migrationBuilder.AddForeignKey(
                name: "FK_PollEntries_Assets_TeaserAssetId",
                table: "PollEntries",
                column: "TeaserAssetId",
                principalTable: "Assets",
                principalColumn: "Id");
        }
    }
}
