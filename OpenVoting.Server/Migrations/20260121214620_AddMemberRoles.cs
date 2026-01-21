using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenVoting.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMemberRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RoleIdsJson",
                table: "CommunityMembers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RoleIdsJson",
                table: "CommunityMembers");
        }
    }
}
