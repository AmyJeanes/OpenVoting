using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ConfigController : ControllerBase
{
	private readonly Settings _settings;

	public ConfigController(IOptions<Settings> settings)
	{
		_settings = settings.Value;
	}

	[HttpGet]
	[ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, NoStore = false)]
	public ActionResult<ClientConfigResponse> Get()
	{
		var authorizeUrl = BuildDiscordAuthorizeUrl();
		return Ok(new ClientConfigResponse
		{
			DiscordAuthorizeUrl = authorizeUrl,
			RedirectUri = _settings.Discord.RedirectUri
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
}
