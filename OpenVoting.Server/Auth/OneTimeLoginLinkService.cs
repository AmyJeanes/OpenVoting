using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Data.Enums;

namespace OpenVoting.Server.Auth;

public interface IOneTimeLoginLinkService
{
	Task<OneTimeLoginIssueResult> IssueForDiscordUserAsync(DiscordInteractionUserContext user, string appBaseUrl, CancellationToken cancellationToken);
	Task<OneTimeLoginConsumeResult> ConsumeAsync(string rawToken, CancellationToken cancellationToken);
}

public sealed class OneTimeLoginLinkService : IOneTimeLoginLinkService
{
	private readonly ApplicationDbContext _db;
	private readonly TokenService _tokenService;
	private readonly DiscordSettings _discordSettings;
	private readonly ILogger<OneTimeLoginLinkService> _logger;

	public OneTimeLoginLinkService(
		ApplicationDbContext db,
		TokenService tokenService,
		IOptions<Settings> settings,
		ILogger<OneTimeLoginLinkService> logger)
	{
		_db = db;
		_tokenService = tokenService;
		_discordSettings = settings.Value.Discord;
		_logger = logger;
	}

	public async Task<OneTimeLoginIssueResult> IssueForDiscordUserAsync(DiscordInteractionUserContext user, string appBaseUrl, CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(user.ExternalUserId))
		{
			throw new ArgumentException("Discord external user id is required", nameof(user));
		}

		if (string.IsNullOrWhiteSpace(appBaseUrl))
		{
			throw new ArgumentException("App base URL is required", nameof(appBaseUrl));
		}

		var utcNow = DateTimeOffset.UtcNow;
		await CleanupExpiredAsync(utcNow, cancellationToken);

		var community = await GetOrCreateCommunity(cancellationToken);
		var member = await _db.CommunityMembers.FirstOrDefaultAsync(
			m => m.CommunityId == community.Id
				&& m.Platform == Platform.Discord
				&& m.ExternalUserId == user.ExternalUserId,
			cancellationToken);

		if (member is null)
		{
			member = new CommunityMember
			{
				Id = Guid.NewGuid(),
				CommunityId = community.Id,
				Platform = Platform.Discord,
				ExternalUserId = user.ExternalUserId,
				DisplayName = user.GlobalName ?? user.Username,
				JoinedAt = user.JoinedAt ?? utcNow,
				RoleIdsJson = JsonSerializer.Serialize(user.RoleIds)
			};

			_db.CommunityMembers.Add(member);
		}
		else
		{
			member.DisplayName = user.GlobalName ?? user.Username;
			member.RoleIdsJson = JsonSerializer.Serialize(user.RoleIds);
			if (user.JoinedAt.HasValue)
			{
				member.JoinedAt = user.JoinedAt.Value;
			}
		}

		var activeTokens = (await _db.OneTimeLoginTokens
			.Where(t => t.CommunityMemberId == member.Id)
			.ToListAsync(cancellationToken))
			.Where(t => t.UsedAt == null && t.RevokedAt == null && t.ExpiresAt > utcNow)
			.ToList();

		foreach (var token in activeTokens)
		{
			token.RevokedAt = utcNow;
		}

		var rawToken = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
		var hash = HashToken(rawToken);
		var expiresAt = utcNow.AddMinutes(Math.Clamp(_discordSettings.LoginLinkExpirationMinutes, 1, 60));

		_db.OneTimeLoginTokens.Add(new OneTimeLoginToken
		{
			Id = Guid.NewGuid(),
			CommunityMemberId = member.Id,
			TokenHash = hash,
			CreatedAt = utcNow,
			ExpiresAt = expiresAt
		});

		await _db.SaveChangesAsync(cancellationToken);

		var link = QueryHelpers.AddQueryString($"{appBaseUrl.TrimEnd('/')}/api/auth/discord-link", "token", rawToken);
		return new OneTimeLoginIssueResult(link, expiresAt);
	}

	public async Task<OneTimeLoginConsumeResult> ConsumeAsync(string rawToken, CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(rawToken))
		{
			return OneTimeLoginConsumeResult.Invalid("Missing login token");
		}

		var utcNow = DateTimeOffset.UtcNow;
		await CleanupExpiredAsync(utcNow, cancellationToken);

		var hash = HashToken(rawToken);
		var token = await _db.OneTimeLoginTokens
			.Include(t => t.CommunityMember)
			.FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);

		if (token is null)
		{
			return OneTimeLoginConsumeResult.Invalid("Login link is invalid");
		}

		if (token.UsedAt.HasValue || token.RevokedAt.HasValue)
		{
			return OneTimeLoginConsumeResult.Invalid("Login link has already been used");
		}

		if (token.ExpiresAt <= utcNow)
		{
			return OneTimeLoginConsumeResult.Invalid("Login link has expired");
		}

		token.UsedAt = utcNow;
		await _db.SaveChangesAsync(cancellationToken);

		var roleIds = ParseRoleIds(token.CommunityMember.RoleIdsJson);
		var isAdmin = _discordSettings.AdminRoleIds.Any(r => roleIds.Contains(r));
		var jwt = _tokenService.GenerateToken(token.CommunityMember, isAdmin);

		if (token.CommunityMember.IsBanned)
		{
			_logger.LogInformation("Blocked one-time login for banned member {MemberId}", token.CommunityMember.Id);
			return OneTimeLoginConsumeResult.Invalid("Member is banned");
		}

		return OneTimeLoginConsumeResult.Success(new OneTimeLoginAuthPayload(jwt));
	}

	private async Task CleanupExpiredAsync(DateTimeOffset utcNow, CancellationToken cancellationToken)
	{
		var hardDeleteBefore = utcNow.AddDays(-1);
		var staleTokens = (await _db.OneTimeLoginTokens.ToListAsync(cancellationToken))
			.Where(t => t.ExpiresAt < hardDeleteBefore
				|| (t.UsedAt.HasValue && t.UsedAt < hardDeleteBefore)
				|| (t.RevokedAt.HasValue && t.RevokedAt < hardDeleteBefore))
			.ToList();

		if (staleTokens.Count == 0)
		{
			return;
		}

		_db.OneTimeLoginTokens.RemoveRange(staleTokens);
		await _db.SaveChangesAsync(cancellationToken);
	}

	private async Task<Community> GetOrCreateCommunity(CancellationToken cancellationToken)
	{
		var existing = await _db.Communities.FirstOrDefaultAsync(
			c => c.Platform == Platform.Discord && c.ExternalCommunityId == _discordSettings.GuildId,
			cancellationToken);

		if (existing is not null)
		{
			return existing;
		}

		var created = new Community
		{
			Id = Guid.NewGuid(),
			Platform = Platform.Discord,
			ExternalCommunityId = _discordSettings.GuildId,
			Name = "Discord Guild"
		};

		_db.Communities.Add(created);
		await _db.SaveChangesAsync(cancellationToken);
		return created;
	}

	private static string HashToken(string rawToken)
	{
		var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
		return Convert.ToHexString(hashBytes);
	}

	private static HashSet<string> ParseRoleIds(string roleIdsJson)
	{
		if (string.IsNullOrWhiteSpace(roleIdsJson))
		{
			return [];
		}

		try
		{
			var parsed = JsonSerializer.Deserialize<string[]>(roleIdsJson) ?? [];
			return parsed.ToHashSet(StringComparer.Ordinal);
		}
		catch (JsonException)
		{
			return [];
		}
	}
}

public sealed record DiscordInteractionUserContext(
	string ExternalUserId,
	string Username,
	string? GlobalName,
	IReadOnlyCollection<string> RoleIds,
	DateTimeOffset? JoinedAt);

public sealed record OneTimeLoginIssueResult(string LoginLink, DateTimeOffset ExpiresAt);

public sealed class OneTimeLoginConsumeResult
{
	private OneTimeLoginConsumeResult(bool isSuccess, string? error, OneTimeLoginAuthPayload? payload)
	{
		IsSuccess = isSuccess;
		Error = error;
		Payload = payload;
	}

	public bool IsSuccess { get; }
	public string? Error { get; }
	public OneTimeLoginAuthPayload? Payload { get; }

	public static OneTimeLoginConsumeResult Success(OneTimeLoginAuthPayload payload) => new(true, null, payload);
	public static OneTimeLoginConsumeResult Invalid(string error) => new(false, error, null);
}

public sealed record OneTimeLoginAuthPayload(string Token);