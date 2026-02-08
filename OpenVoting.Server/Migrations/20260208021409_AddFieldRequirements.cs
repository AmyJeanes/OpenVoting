using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenVoting.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddFieldRequirements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PollEntries_Assets_OriginalAssetId",
                table: "PollEntries");

            migrationBuilder.AddColumn<int>(
                name: "DescriptionRequirement",
                table: "Polls",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "ImageRequirement",
                table: "Polls",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<int>(
                name: "TitleRequirement",
                table: "Polls",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AlterColumn<Guid>(
                name: "OriginalAssetId",
                table: "PollEntries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "FK_PollEntries_Assets_OriginalAssetId",
                table: "PollEntries",
                column: "OriginalAssetId",
                principalTable: "Assets",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PollEntries_Assets_OriginalAssetId",
                table: "PollEntries");

            migrationBuilder.DropColumn(
                name: "DescriptionRequirement",
                table: "Polls");

            migrationBuilder.DropColumn(
                name: "ImageRequirement",
                table: "Polls");

            migrationBuilder.DropColumn(
                name: "TitleRequirement",
                table: "Polls");

            migrationBuilder.AlterColumn<Guid>(
                name: "OriginalAssetId",
                table: "PollEntries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PollEntries_Assets_OriginalAssetId",
                table: "PollEntries",
                column: "OriginalAssetId",
                principalTable: "Assets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
