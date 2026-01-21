using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenVoting.Server.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Assets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StorageKey = table.Column<string>(type: "text", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false),
                    Bytes = table.Column<long>(type: "bigint", nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: true),
                    Height = table.Column<int>(type: "integer", nullable: true),
                    Sha256 = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Communities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<int>(type: "integer", nullable: false),
                    ExternalCommunityId = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Communities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CommunityMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CommunityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<int>(type: "integer", nullable: false),
                    ExternalUserId = table.Column<string>(type: "text", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsBanned = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommunityMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommunityMembers_Communities_CommunityId",
                        column: x => x.CommunityId,
                        principalTable: "Communities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Polls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CommunityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    VotingMethod = table.Column<int>(type: "integer", nullable: false),
                    SubmissionOpensAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmissionClosesAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    VotingOpensAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    VotingClosesAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    MustHaveJoinedBefore = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RequiredRoleIdsJson = table.Column<string>(type: "text", nullable: true),
                    MaxSelections = table.Column<int>(type: "integer", nullable: false),
                    RequireRanking = table.Column<bool>(type: "boolean", nullable: false),
                    MaxSubmissionsPerMember = table.Column<int>(type: "integer", nullable: false),
                    HideEntriesUntilVoting = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LockedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Polls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Polls_Communities_CommunityId",
                        column: x => x.CommunityId,
                        principalTable: "Communities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PollEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PollId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedByMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    OriginalAssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    TeaserAssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    PublicAssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LockedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsDisqualified = table.Column<bool>(type: "boolean", nullable: false),
                    DisqualificationReason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PollEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PollEntries_Assets_OriginalAssetId",
                        column: x => x.OriginalAssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PollEntries_Assets_PublicAssetId",
                        column: x => x.PublicAssetId,
                        principalTable: "Assets",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PollEntries_Assets_TeaserAssetId",
                        column: x => x.TeaserAssetId,
                        principalTable: "Assets",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PollEntries_CommunityMembers_SubmittedByMemberId",
                        column: x => x.SubmittedByMemberId,
                        principalTable: "CommunityMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PollEntries_Polls_PollId",
                        column: x => x.PollId,
                        principalTable: "Polls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Votes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PollId = table.Column<Guid>(type: "uuid", nullable: false),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsFinal = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Votes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Votes_CommunityMembers_MemberId",
                        column: x => x.MemberId,
                        principalTable: "CommunityMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Votes_Polls_PollId",
                        column: x => x.PollId,
                        principalTable: "Polls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VoteChoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Rank = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoteChoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VoteChoices_PollEntries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "PollEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VoteChoices_Votes_VoteId",
                        column: x => x.VoteId,
                        principalTable: "Votes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Communities_Platform_ExternalCommunityId",
                table: "Communities",
                columns: new[] { "Platform", "ExternalCommunityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CommunityMembers_CommunityId_Platform_ExternalUserId",
                table: "CommunityMembers",
                columns: new[] { "CommunityId", "Platform", "ExternalUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_OriginalAssetId",
                table: "PollEntries",
                column: "OriginalAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_PollId",
                table: "PollEntries",
                column: "PollId");

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_PublicAssetId",
                table: "PollEntries",
                column: "PublicAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_SubmittedByMemberId",
                table: "PollEntries",
                column: "SubmittedByMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_PollEntries_TeaserAssetId",
                table: "PollEntries",
                column: "TeaserAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Polls_CommunityId_Status",
                table: "Polls",
                columns: new[] { "CommunityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_VoteChoices_EntryId",
                table: "VoteChoices",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_VoteChoices_VoteId_EntryId",
                table: "VoteChoices",
                columns: new[] { "VoteId", "EntryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoteChoices_VoteId_Rank",
                table: "VoteChoices",
                columns: new[] { "VoteId", "Rank" });

            migrationBuilder.CreateIndex(
                name: "IX_Votes_MemberId",
                table: "Votes",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_PollId_MemberId",
                table: "Votes",
                columns: new[] { "PollId", "MemberId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VoteChoices");

            migrationBuilder.DropTable(
                name: "PollEntries");

            migrationBuilder.DropTable(
                name: "Votes");

            migrationBuilder.DropTable(
                name: "Assets");

            migrationBuilder.DropTable(
                name: "CommunityMembers");

            migrationBuilder.DropTable(
                name: "Polls");

            migrationBuilder.DropTable(
                name: "Communities");
        }
    }
}
