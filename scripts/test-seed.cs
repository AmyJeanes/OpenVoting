#!/usr/bin/env dotnet run
#:property PublishAot=false
#:project ../OpenVoting.Server/OpenVoting.Server.csproj

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server;
using OpenVoting.Server.Auth;

var connectionString = Environment.GetEnvironmentVariable("PLAYWRIGHT_DB_CONNECTION")
    ?? throw new InvalidOperationException("PLAYWRIGHT_DB_CONNECTION is required");
var sessionFile = Environment.GetEnvironmentVariable("PLAYWRIGHT_SESSION_FILE")
    ?? throw new InvalidOperationException("PLAYWRIGHT_SESSION_FILE is required");
var jwtSigningKey = Environment.GetEnvironmentVariable("PLAYWRIGHT_JWT_SIGNING_KEY")
    ?? throw new InvalidOperationException("PLAYWRIGHT_JWT_SIGNING_KEY is required");
var guildId = Environment.GetEnvironmentVariable("PLAYWRIGHT_GUILD_ID") ?? "smoke-guild";
var adminRoleId = Environment.GetEnvironmentVariable("PLAYWRIGHT_ADMIN_ROLE_ID") ?? "smoke-admin";

var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseNpgsql(connectionString)
    .Options;

await using var db = new ApplicationDbContext(dbOptions);
await db.Database.MigrateAsync();

await db.VoteChoices.ExecuteDeleteAsync();
await db.Votes.ExecuteDeleteAsync();
await db.OneTimeLoginTokens.ExecuteDeleteAsync();
await db.PollEntries.ExecuteDeleteAsync();
await db.Polls.ExecuteDeleteAsync();
await db.Assets.ExecuteDeleteAsync();
await db.CommunityMembers.ExecuteDeleteAsync();
await db.Communities.ExecuteDeleteAsync();

var now = DateTimeOffset.UtcNow;
var community = new Community
{
    Id = Guid.NewGuid(),
    Platform = Platform.Discord,
    ExternalCommunityId = guildId,
    Name = "Playwright Test Guild"
};

var adminMember = new CommunityMember
{
    Id = Guid.NewGuid(),
    CommunityId = community.Id,
    Platform = Platform.Discord,
    ExternalUserId = "playwright-admin-user",
    DisplayName = "Smoke Admin",
    RoleIdsJson = JsonSerializer.Serialize(new[] { adminRoleId }),
    JoinedAt = now.AddDays(-90)
};

const string livePollTitle = "Seed Live Poll";
const string closedPollTitle = "Seed History Poll";
const string liveEntryTitle = "Seed Entry";

var livePoll = new Poll
{
    Id = Guid.NewGuid(),
    CommunityId = community.Id,
    Title = livePollTitle,
    Description = "Shared Playwright seed live poll",
    Status = PollStatus.VotingOpen,
    VotingMethod = VotingMethod.Approval,
    SubmissionOpensAt = now.AddDays(-3),
    SubmissionClosesAt = now.AddDays(-2),
    VotingOpensAt = now.AddHours(-2),
    VotingClosesAt = now.AddDays(2),
    MaxSelections = 1,
    RequireRanking = false,
    TitleRequirement = FieldRequirement.Required,
    DescriptionRequirement = FieldRequirement.Optional,
    ImageRequirement = FieldRequirement.Off,
    MaxSubmissionsPerMember = 1,
    HideEntriesUntilVoting = false
};

var liveEntry = new PollEntry
{
    Id = Guid.NewGuid(),
    PollId = livePoll.Id,
    SubmittedByMemberId = adminMember.Id,
    DisplayName = liveEntryTitle,
    Description = "Playable seeded test entry"
};

var closedPoll = new Poll
{
    Id = Guid.NewGuid(),
    CommunityId = community.Id,
    Title = closedPollTitle,
    Description = "Shared Playwright seed history poll",
    Status = PollStatus.Closed,
    VotingMethod = VotingMethod.Approval,
    SubmissionOpensAt = now.AddDays(-10),
    SubmissionClosesAt = now.AddDays(-9),
    VotingOpensAt = now.AddDays(-8),
    VotingClosesAt = now.AddDays(-7),
    MaxSelections = 1,
    RequireRanking = false,
    TitleRequirement = FieldRequirement.Required,
    DescriptionRequirement = FieldRequirement.Optional,
    ImageRequirement = FieldRequirement.Off,
    MaxSubmissionsPerMember = 1,
    HideEntriesUntilVoting = false,
    LockedAt = now.AddDays(-8)
};

var closedEntry = new PollEntry
{
    Id = Guid.NewGuid(),
    PollId = closedPoll.Id,
    SubmittedByMemberId = adminMember.Id,
    DisplayName = "Seed Winner",
    Description = "Winning seeded history entry"
};

var closedVote = new Vote
{
    Id = Guid.NewGuid(),
    PollId = closedPoll.Id,
    MemberId = adminMember.Id,
    CreatedAt = now.AddDays(-8),
    SubmittedAt = now.AddDays(-8),
    IsFinal = true,
    Choices =
    [
        new VoteChoice
        {
            Id = Guid.NewGuid(),
            EntryId = closedEntry.Id,
            Rank = null
        }
    ]
};

db.Communities.Add(community);
db.CommunityMembers.Add(adminMember);
db.Polls.AddRange(livePoll, closedPoll);
db.PollEntries.AddRange(liveEntry, closedEntry);
db.Votes.Add(closedVote);
await db.SaveChangesAsync();

var tokenService = new TokenService(Options.Create(new Settings
{
    Jwt = new JwtSettings
    {
        Issuer = "OpenVoting",
        Audience = "OpenVoting",
        SigningKey = jwtSigningKey,
        ExpirationMinutes = 60
    }
}));

var payload = new
{
    token = tokenService.GenerateToken(adminMember, isAdmin: true),
    livePollTitle,
    closedPollTitle,
    liveEntryTitle,
    displayName = adminMember.DisplayName
};

await File.WriteAllTextAsync(sessionFile, JsonSerializer.Serialize(payload));