using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Controllers;
using OpenVoting.Server.Tests.Helpers;

namespace OpenVoting.Server.Tests;

public class AuthControllerDiscordCallbackTests
{
	[Test]
	public async Task ExchangeDiscordCodeGet_WithSafeState_RedirectsBackToReturnTo()
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
			new SuccessfulDiscordOAuthService(),
			new FakeOneTimeLoginLinkService(),
			settings,
			NullLogger<AuthController>.Instance)
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext
				{
					Request =
					{
						Scheme = "https",
						Host = new HostString("vote.example.com")
					}
				}
			}
		};

		var result = await controller.ExchangeDiscordCodeGet(
			code: "oauth-code",
			error: null,
			errorDescription: null,
			state: "/polls/live/poll-123?tab=vote#entry-1",
			cancellationToken: CancellationToken.None);

		var redirect = result as RedirectResult;
		Assert.That(redirect, Is.Not.Null);

		var uri = new Uri(redirect!.Url!);
		var query = QueryHelpers.ParseQuery(uri.Query);
		Assert.Multiple(() =>
		{
			Assert.That(uri.GetLeftPart(UriPartial.Path), Is.EqualTo("https://vote.example.com/polls/live/poll-123"));
			Assert.That(query["tab"].ToString(), Is.EqualTo("vote"));
			Assert.That(query["token"].ToString(), Is.Not.Empty);
			Assert.That(uri.Fragment, Is.EqualTo("#entry-1"));
		});
	}

	[Test]
	public async Task ExchangeDiscordCodeGet_WithUnsafeState_DoesNotIncludeReturnTo()
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
			new SuccessfulDiscordOAuthService(),
			new FakeOneTimeLoginLinkService(),
			settings,
			NullLogger<AuthController>.Instance)
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext
				{
					Request =
					{
						Scheme = "https",
						Host = new HostString("vote.example.com")
					}
				}
			}
		};

		var result = await controller.ExchangeDiscordCodeGet(
			code: "oauth-code",
			error: null,
			errorDescription: null,
			state: "https://evil.example/steal",
			cancellationToken: CancellationToken.None);

		var redirect = result as RedirectResult;
		Assert.That(redirect, Is.Not.Null);

		var uri = new Uri(redirect!.Url!);
		var query = QueryHelpers.ParseQuery(uri.Query);
		Assert.Multiple(() =>
		{
			Assert.That(uri.GetLeftPart(UriPartial.Path), Is.EqualTo("https://vote.example.com/"));
			Assert.That(query["token"].ToString(), Is.Not.Empty);
		});
	}

	private sealed class SuccessfulDiscordOAuthService : IDiscordOAuthService
	{
		public Task<DiscordAuthResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken cancellationToken)
		{
			return Task.FromResult(new DiscordAuthResult
			{
				Platform = Platform.Discord,
				ExternalUserId = "discord-user-123",
				Username = "member",
				GlobalName = "Member",
				JoinedAt = DateTimeOffset.UtcNow,
				RoleIds = Array.Empty<string>(),
				IsGuildMember = true
			});
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