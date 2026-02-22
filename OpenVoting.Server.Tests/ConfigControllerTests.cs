using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using OpenVoting.Server;
using OpenVoting.Server.Controllers;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Tests;

public class ConfigControllerTests
{
	[Test]
	public async Task Get_BuildsRedirectUriAndAuthorizeUrl_FromRequestHostAndPathBase()
	{
		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = "client-123",
				ClientSecret = "secret",
				GuildId = "guild"
			}
		});

		var controller = new ConfigController(settings, new FakeDiscordGuildService(new DiscordGuildInfo("guild-1", "OpenVoting Guild", "https://cdn.example/icon.png")))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext
				{
					Request =
					{
						Scheme = "https",
						Host = new HostString("vote.example.com"),
						PathBase = new PathString("/portal")
					}
				}
			}
		};

		var result = await controller.Get(CancellationToken.None);
		var ok = result.Result as OkObjectResult;
		Assert.That(ok, Is.Not.Null);

		var payload = ok!.Value as ClientConfigResponse;
		Assert.That(payload, Is.Not.Null);
		Assert.That(payload!.DiscordAuthorizeUrl, Is.Not.Empty);
		Assert.That(payload.ServerName, Is.EqualTo("OpenVoting Guild"));
		Assert.That(payload.ServerIconUrl, Is.EqualTo("https://cdn.example/icon.png"));

		var authorizeUri = new Uri(payload.DiscordAuthorizeUrl);
		var query = QueryHelpers.ParseQuery(authorizeUri.Query);
		Assert.Multiple(() =>
		{
			Assert.That(authorizeUri.GetLeftPart(UriPartial.Path), Is.EqualTo("https://discord.com/oauth2/authorize"));
			Assert.That(query["client_id"].ToString(), Is.EqualTo("client-123"));
			Assert.That(query["redirect_uri"].ToString(), Is.EqualTo("https://vote.example.com/portal/auth/discord-callback"));
			Assert.That(query["response_type"].ToString(), Is.EqualTo("code"));
			Assert.That(query["scope"].ToString(), Is.EqualTo("identify guilds.members.read"));
		});
	}

	[Test]
	public async Task Get_WithoutDiscordClientId_ReturnsEmptyAuthorizeUrl()
	{
		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = string.Empty,
				ClientSecret = "secret",
				GuildId = "guild"
			}
		});

		var controller = new ConfigController(settings, new FakeDiscordGuildService(null))
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

		var result = await controller.Get(CancellationToken.None);
		var ok = result.Result as OkObjectResult;
		Assert.That(ok, Is.Not.Null);

		var payload = ok!.Value as ClientConfigResponse;
		Assert.That(payload, Is.Not.Null);
		Assert.Multiple(() =>
		{
			Assert.That(payload!.DiscordAuthorizeUrl, Is.Empty);
			Assert.That(payload.ServerName, Is.EqualTo("OpenVoting"));
			Assert.That(payload.ServerIconUrl, Is.Empty);
		});
	}

	private sealed class FakeDiscordGuildService : IDiscordGuildService
	{
		private readonly DiscordGuildInfo? _guildInfo;

		public FakeDiscordGuildService(DiscordGuildInfo? guildInfo)
		{
			_guildInfo = guildInfo;
		}

		public Task<DiscordGuildInfo?> GetGuildInfoAsync(CancellationToken cancellationToken)
		{
			return Task.FromResult(_guildInfo);
		}
	}
}
