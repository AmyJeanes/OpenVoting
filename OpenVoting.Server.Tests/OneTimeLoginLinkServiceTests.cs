using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Server;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Tests.Helpers;

namespace OpenVoting.Server.Tests;

public class OneTimeLoginLinkServiceTests
{
	[Test]
	public async Task IssueAndConsume_SucceedsOnce_ThenRejectsReplay()
	{
		using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var service = CreateService(db, adminRoleIds: ["admin-role"]);

		var issue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-1", "Amy", "Amy Jane", ["admin-role"], DateTimeOffset.UtcNow.AddYears(-1)),
			"https://vote.example.com",
			CancellationToken.None);

		var token = ExtractToken(issue.LoginLink);
		var consume = await service.ConsumeAsync(token, CancellationToken.None);
		Assert.Multiple(() =>
		{
			Assert.That(consume.IsSuccess, Is.True);
			Assert.That(consume.Payload, Is.Not.Null);
			Assert.That(consume.Payload!.Token, Is.Not.Empty);
		});

		var replay = await service.ConsumeAsync(token, CancellationToken.None);
		Assert.Multiple(() =>
		{
			Assert.That(replay.IsSuccess, Is.False);
			Assert.That(replay.Error, Is.EqualTo("Login link has already been used"));
		});
	}

	[Test]
	public async Task Reissue_RevokesPriorUnusedLink()
	{
		using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var service = CreateService(db);

		var firstIssue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-2", "UserTwo", null, [], null),
			"https://vote.example.com",
			CancellationToken.None);

		var secondIssue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-2", "UserTwo", null, [], null),
			"https://vote.example.com",
			CancellationToken.None);

		var firstConsume = await service.ConsumeAsync(ExtractToken(firstIssue.LoginLink), CancellationToken.None);
		var secondConsume = await service.ConsumeAsync(ExtractToken(secondIssue.LoginLink), CancellationToken.None);

		Assert.Multiple(() =>
		{
			Assert.That(firstConsume.IsSuccess, Is.False);
			Assert.That(secondConsume.IsSuccess, Is.True);
		});
	}

	[Test]
	public async Task Consume_ExpiredLink_ReturnsExpiredError()
	{
		using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var service = CreateService(db);

		var issue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-3", "UserThree", null, [], null),
			"https://vote.example.com",
			CancellationToken.None);

		var tokenHash = GetTokenHash(db);
		var entity = await db.OneTimeLoginTokens.SingleAsync(t => t.TokenHash == tokenHash, CancellationToken.None);
		entity.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
		await db.SaveChangesAsync(CancellationToken.None);

		var consume = await service.ConsumeAsync(ExtractToken(issue.LoginLink), CancellationToken.None);
		Assert.Multiple(() =>
		{
			Assert.That(consume.IsSuccess, Is.False);
			Assert.That(consume.Error, Is.EqualTo("Login link has expired"));
		});
	}

	[Test]
	public async Task Consume_BannedMember_ReturnsForbiddenError()
	{
		using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var service = CreateService(db);

		var issue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-4", "UserFour", null, [], null),
			"https://vote.example.com",
			CancellationToken.None);

		var member = await db.CommunityMembers.SingleAsync(m => m.ExternalUserId == "user-4", CancellationToken.None);
		member.IsBanned = true;
		await db.SaveChangesAsync(CancellationToken.None);

		var consume = await service.ConsumeAsync(ExtractToken(issue.LoginLink), CancellationToken.None);
		Assert.Multiple(() =>
		{
			Assert.That(consume.IsSuccess, Is.False);
			Assert.That(consume.Error, Is.EqualTo("Member is banned"));
		});
	}

	[Test]
	public async Task GetStatusAsync_UsedToken_ReturnsUsed()
	{
		using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var service = CreateService(db);

		var issue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-5", "UserFive", "User Five", [], null),
			"https://vote.example.com",
			CancellationToken.None);

		var token = ExtractToken(issue.LoginLink);
		_ = await service.ConsumeAsync(token, CancellationToken.None);

		var status = await service.GetStatusAsync(token, CancellationToken.None);
		Assert.Multiple(() =>
		{
			Assert.That(status.Status, Is.EqualTo(OneTimeLoginLinkStatus.Used));
			Assert.That(status.DisplayName, Is.EqualTo("User Five"));
		});
	}

	[Test]
	public async Task CleanupStaleAsync_RemovesOldExpiredRows()
	{
		using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var service = CreateService(db);

		var issue = await service.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext("user-6", "UserSix", null, [], null),
			"https://vote.example.com",
			CancellationToken.None);

		var tokenHash = GetTokenHash(db);
		var entity = await db.OneTimeLoginTokens.SingleAsync(t => t.TokenHash == tokenHash, CancellationToken.None);
		entity.ExpiresAt = DateTimeOffset.UtcNow.AddDays(-2);
		await db.SaveChangesAsync(CancellationToken.None);

		var deletedCount = await service.CleanupStaleAsync(CancellationToken.None);
		var remaining = await db.OneTimeLoginTokens.CountAsync(CancellationToken.None);

		Assert.Multiple(() =>
		{
			Assert.That(deletedCount, Is.EqualTo(1));
			Assert.That(remaining, Is.EqualTo(0));
		});
	}

	private static OneTimeLoginLinkService CreateService(ApplicationDbContext db, string[]? adminRoleIds = null)
	{
		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				GuildId = "guild-1",
				AdminRoleIds = adminRoleIds ?? [],
				LoginLinkExpirationMinutes = 5
			},
			Jwt = new JwtSettings
			{
				Issuer = "test",
				Audience = "test",
				SigningKey = "super-secret-signing-key-for-tests-12345",
				ExpirationMinutes = 60
			}
		});

		var tokenService = new TokenService(settings);
		return new OneTimeLoginLinkService(db, tokenService, settings, NullLogger<OneTimeLoginLinkService>.Instance);
	}

	private static string ExtractToken(string link)
	{
		var query = QueryHelpers.ParseQuery(new Uri(link).Query);
		return query["token"].ToString();
	}

	private static string GetTokenHash(ApplicationDbContext db)
	{
		return db.OneTimeLoginTokens.Select(t => t.TokenHash).Single();
	}
}