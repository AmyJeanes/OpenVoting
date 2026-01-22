using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ConfigController : ControllerBase
{
	private readonly Settings _settings;
	private readonly IDiscordGuildService _discordGuildService;

	public ConfigController(IOptions<Settings> settings, IDiscordGuildService discordGuildService)
	{
		_settings = settings.Value;
		_discordGuildService = discordGuildService;
	}

	[HttpGet]
	[ResponseCache(Duration = 600, Location = ResponseCacheLocation.Any, NoStore = false)]
	public async Task<ActionResult<ClientConfigResponse>> Get(CancellationToken cancellationToken)
	{
		var authorizeUrl = BuildDiscordAuthorizeUrl();
		var guildInfo = await _discordGuildService.GetGuildInfoAsync(cancellationToken);
		var serverName = guildInfo?.Name ?? "OpenVoting";
		var serverIcon = guildInfo?.IconUrl ?? string.Empty;

		return Ok(new ClientConfigResponse
		{
			DiscordAuthorizeUrl = authorizeUrl,
			RedirectUri = _settings.Discord.RedirectUri,
			ServerName = serverName,
			ServerIconUrl = serverIcon
		});
	}

	private string BuildDiscordAuthorizeUrl()
	{
		if (string.IsNullOrWhiteSpace(_settings.Discord.ClientId) || string.IsNullOrWhiteSpace(_settings.Discord.RedirectUri))
		{
			return string.Empty;
		}

		var query = new Dictionary<string, string?>
		{
			{"client_id", _settings.Discord.ClientId},
			{"redirect_uri", _settings.Discord.RedirectUri},
			{"response_type", "code"},
			{"scope", "identify guilds.members.read"},
			{"prompt", "consent"}
		};

		return QueryHelpers.AddQueryString("https://discord.com/oauth2/authorize", query);
	}
}

public sealed class ClientConfigResponse
{
	public string DiscordAuthorizeUrl { get; init; } = string.Empty;
	public string RedirectUri { get; init; } = string.Empty;
	public string ServerName { get; init; } = string.Empty;
	public string ServerIconUrl { get; init; } = string.Empty;
}
