using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
	private readonly ApplicationDbContext _db;
	private readonly TokenService _tokenService;
	private readonly IDiscordOAuthService _discordOAuthService;
	private readonly DiscordSettings _discordSettings;
	private readonly ILogger<AuthController> _logger;

	public AuthController(
		ApplicationDbContext db,
		TokenService tokenService,
		IDiscordOAuthService discordOAuthService,
		IOptions<Settings> settings,
		ILogger<AuthController> logger)
	{
		_db = db;
		_tokenService = tokenService;
		_discordOAuthService = discordOAuthService;
		_discordSettings = settings.Value.Discord;
		_logger = logger;
	}

	[AllowAnonymous]
	[HttpPost("discord")]
	public async Task<ActionResult> ExchangeDiscordCode([FromBody] DiscordAuthRequest request, CancellationToken cancellationToken)
	{
		return await ExchangeDiscordCodeInternal(request.Code, request.RedirectUri, returnHtml: false, cancellationToken);
	}

	[AllowAnonymous]
	[HttpGet("discord")]
	public async Task<ActionResult> ExchangeDiscordCodeGet([FromQuery] string code, [FromQuery] string? redirectUri, CancellationToken cancellationToken)
	{
		return await ExchangeDiscordCodeInternal(code, redirectUri, returnHtml: true, cancellationToken);
	}

	private async Task<ActionResult> ExchangeDiscordCodeInternal(string code, string? redirectUri, bool returnHtml, CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(code))
		{
			return BadRequest("Missing authorization code");
		}

		var authResult = await _discordOAuthService.ExchangeCodeAsync(code, redirectUri ?? _discordSettings.RedirectUri, cancellationToken);
		if (!authResult.IsGuildMember)
		{
			return Forbid();
		}

		var community = await GetOrCreateCommunity(cancellationToken);
		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.CommunityId == community.Id && m.Platform == Platform.Discord && m.ExternalUserId == authResult.ExternalUserId, cancellationToken);

		if (member is null)
		{
			member = new CommunityMember
			{
				Id = Guid.NewGuid(),
				CommunityId = community.Id,
				Platform = Platform.Discord,
				ExternalUserId = authResult.ExternalUserId,
				DisplayName = authResult.GlobalName ?? authResult.Username,
				JoinedAt = authResult.JoinedAt ?? DateTimeOffset.UtcNow,
				RoleIdsJson = JsonSerializer.Serialize(authResult.RoleIds)
			};
			_db.CommunityMembers.Add(member);
		}
		else
		{
			member.DisplayName = authResult.GlobalName ?? authResult.Username;
			if (authResult.JoinedAt.HasValue)
			{
				member.JoinedAt = authResult.JoinedAt.Value;
			}
			member.RoleIdsJson = JsonSerializer.Serialize(authResult.RoleIds);
		}

		await _db.SaveChangesAsync(cancellationToken);

		var eligibility = CalculateEligibility(authResult, member);
		var isAdmin = _discordSettings.AdminRoleIds.Any(r => authResult.RoleIds.Contains(r));
		var token = _tokenService.GenerateToken(member, isAdmin);

		var payload = new AuthResponse
		{
			Token = token,
			MemberId = member.Id,
			CommunityId = community.Id,
			DisplayName = member.DisplayName,
			JoinedAt = member.JoinedAt,
			IsEligible = eligibility.IsEligible,
			IneligibleReason = eligibility.Reason,
			IsAdmin = isAdmin
		};

		if (returnHtml)
		{
			var tokenJs = JsonSerializer.Serialize(token);
			var html = $"<html><body><script>localStorage.setItem('ov_token',{tokenJs});window.location='/'</script></body></html>";
			return Content(html, "text/html");
		}

		return Ok(payload);
	}

	[Authorize]
	[HttpGet("me")]
	public async Task<ActionResult<AuthResponse>> Me(CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var eligibility = CalculateEligibilityFromStored(member);

		return Ok(new AuthResponse
		{
			Token = string.Empty,
			MemberId = member.Id,
			CommunityId = member.CommunityId,
			DisplayName = member.DisplayName,
			JoinedAt = member.JoinedAt,
			IsEligible = eligibility.IsEligible,
			IneligibleReason = eligibility.Reason,
			IsAdmin = authUser.IsAdmin
		});
	}

	private async Task<Community> GetOrCreateCommunity(CancellationToken cancellationToken)
	{
		var existing = await _db.Communities.FirstOrDefaultAsync(c => c.Platform == Platform.Discord && c.ExternalCommunityId == _discordSettings.GuildId, cancellationToken);
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

	private EligibilityResult CalculateEligibility(DiscordAuthResult authResult, CommunityMember member)
	{
		if (member.IsBanned)
		{
			return EligibilityResult.Forbidden("Member is banned");
		}

		return EligibilityResult.Allowed();
	}

	private EligibilityResult CalculateEligibilityFromStored(CommunityMember member)
	{
		if (member.IsBanned)
		{
			return EligibilityResult.Forbidden("Member is banned");
		}

		return EligibilityResult.Allowed();
	}
}

public sealed class DiscordAuthRequest
{
	public string Code { get; init; } = string.Empty;
	public string? RedirectUri { get; init; }
}

public sealed class AuthResponse
{
	public Guid MemberId { get; init; }
	public Guid CommunityId { get; init; }
	public string DisplayName { get; init; } = string.Empty;
	public DateTimeOffset JoinedAt { get; init; }
	public bool IsEligible { get; init; }
	public string? IneligibleReason { get; init; }
	public string Token { get; init; } = string.Empty;
	public bool IsAdmin { get; init; }
}

internal readonly record struct EligibilityResult(bool IsEligible, string? Reason)
{
	public static EligibilityResult Allowed() => new(true, null);
	public static EligibilityResult Forbidden(string reason) => new(false, reason);
}
