using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Controllers;
using OpenVoting.Server.Tests.Helpers;

namespace OpenVoting.Server.Tests;

public class AuthControllerRefreshTests
{
	[Test]
	public async Task Refresh_WhenAuthorized_ReturnsNewTokenPayload()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var member = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = Guid.NewGuid(),
			Platform = Platform.Discord,
			ExternalUserId = "discord-user-1",
			DisplayName = "Refresh Tester",
			JoinedAt = DateTimeOffset.UtcNow
		};

		db.CommunityMembers.Add(member);
		await db.SaveChangesAsync();

		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = "client-id",
				ClientSecret = "client-secret",
				GuildId = "guild-id"
			},
			Jwt = new JwtSettings
			{
				Issuer = "OpenVoting.Test",
				Audience = "OpenVoting.Test",
				SigningKey = "super-secret-signing-key-for-tests-12345",
				ExpirationMinutes = 30
			}
		});

		var tokenService = new TokenService(settings);
		var controller = new AuthController(
			db,
			tokenService,
			new FakeDiscordOAuthService(),
			new FakeOneTimeLoginLinkService(),
			settings,
			NullLogger<AuthController>.Instance)
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext
				{
					User = TestAuthHelper.CreatePrincipal(member.Id, member.CommunityId, isAdmin: true)
				}
			}
		};

		var result = await controller.Refresh(CancellationToken.None);
		var ok = result.Result as OkObjectResult;
		Assert.That(ok, Is.Not.Null);

		var payload = ok!.Value as AuthResponse;
		Assert.That(payload, Is.Not.Null);
		Assert.Multiple(() =>
		{
			Assert.That(payload!.Token, Is.Not.Empty);
			Assert.That(payload.MemberId, Is.EqualTo(member.Id));
			Assert.That(payload.CommunityId, Is.EqualTo(member.CommunityId));
			Assert.That(payload.DisplayName, Is.EqualTo(member.DisplayName));
			Assert.That(payload.IsAdmin, Is.True);
		});
	}

	[Test]
	public async Task Refresh_WhenUserMissing_ReturnsUnauthorized()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = "client-id",
				ClientSecret = "client-secret",
				GuildId = "guild-id"
			},
			Jwt = new JwtSettings
			{
				Issuer = "OpenVoting.Test",
				Audience = "OpenVoting.Test",
				SigningKey = "super-secret-signing-key-for-tests-12345",
				ExpirationMinutes = 30
			}
		});

		var tokenService = new TokenService(settings);
		var controller = new AuthController(
			db,
			tokenService,
			new FakeDiscordOAuthService(),
			new FakeOneTimeLoginLinkService(),
			settings,
			NullLogger<AuthController>.Instance)
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext
				{
					User = new System.Security.Claims.ClaimsPrincipal()
				}
			}
		};

		var result = await controller.Refresh(CancellationToken.None);

		Assert.That(result.Result, Is.TypeOf<UnauthorizedResult>());
	}

	private sealed class FakeDiscordOAuthService : IDiscordOAuthService
	{
		public Task<DiscordAuthResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken cancellationToken)
		{
			throw new NotSupportedException();
		}
	}

	private sealed class FakeOneTimeLoginLinkService : IOneTimeLoginLinkService
	{
		public Task<OneTimeLoginIssueResult> IssueForDiscordUserAsync(DiscordInteractionUserContext user, string appBaseUrl, CancellationToken cancellationToken)
		{
			throw new NotSupportedException();
		}

		public Task<OneTimeLoginConsumeResult> ConsumeAsync(string rawToken, CancellationToken cancellationToken)
		{
			throw new NotSupportedException();
		}

		public Task<OneTimeLoginLinkStatusResult> GetStatusAsync(string rawToken, CancellationToken cancellationToken)
		{
			throw new NotSupportedException();
		}

		public Task<int> CleanupStaleAsync(CancellationToken cancellationToken)
		{
			throw new NotSupportedException();
		}
	}
}
