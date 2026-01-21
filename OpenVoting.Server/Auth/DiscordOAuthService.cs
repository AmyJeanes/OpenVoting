using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using OpenVoting.Data.Enums;

namespace OpenVoting.Server.Auth;

public interface IDiscordOAuthService
{
	Task<DiscordAuthResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken cancellationToken);
}

public sealed class DiscordOAuthService : IDiscordOAuthService
{
	private readonly HttpClient _httpClient;
	private readonly DiscordSettings _settings;
	private readonly ILogger<DiscordOAuthService> _logger;

	public DiscordOAuthService(HttpClient httpClient, IOptions<Settings> options, ILogger<DiscordOAuthService> logger)
	{
		_httpClient = httpClient;
		_settings = options.Value.Discord;
		_logger = logger;
	}

	public async Task<DiscordAuthResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken cancellationToken)
	{
		var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "oauth2/token")
		{
			Content = new FormUrlEncodedContent(new Dictionary<string, string>
			{
				{"client_id", _settings.ClientId},
				{"client_secret", _settings.ClientSecret},
				{"grant_type", "authorization_code"},
				{"code", code},
				{"redirect_uri", redirectUri}
			})
		};

		var tokenResponse = await _httpClient.SendAsync(tokenRequest, cancellationToken);
		tokenResponse.EnsureSuccessStatusCode();

		var tokenPayload = await tokenResponse.Content.ReadFromJsonAsync<DiscordTokenResponse>(cancellationToken: cancellationToken)
			?? throw new InvalidOperationException("Failed to read Discord token response");

		var user = await GetUserAsync(tokenPayload.AccessToken, cancellationToken);
		var guild = await GetGuildMembershipAsync(tokenPayload.AccessToken, cancellationToken);

		return new DiscordAuthResult
		{
			Platform = Platform.Discord,
			ExternalUserId = user.Id,
			Username = user.Username,
			GlobalName = user.GlobalName,
			JoinedAt = guild?.JoinedAt,
			RoleIds = guild?.Roles ?? Array.Empty<string>(),
			IsGuildMember = guild is not null
		};
	}

	private async Task<DiscordUserResponse> GetUserAsync(string accessToken, CancellationToken cancellationToken)
	{
		var request = new HttpRequestMessage(HttpMethod.Get, "users/@me");
		request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

		var response = await _httpClient.SendAsync(request, cancellationToken);
		response.EnsureSuccessStatusCode();

		return await response.Content.ReadFromJsonAsync<DiscordUserResponse>(cancellationToken: cancellationToken)
			?? throw new InvalidOperationException("Failed to read Discord user response");
	}

	private async Task<DiscordGuildMemberResponse?> GetGuildMembershipAsync(string accessToken, CancellationToken cancellationToken)
	{
		var request = new HttpRequestMessage(HttpMethod.Get, $"users/@me/guilds/{_settings.GuildId}/member");
		request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

		var response = await _httpClient.SendAsync(request, cancellationToken);
		if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
		{
			return null;
		}

		response.EnsureSuccessStatusCode();

		return await response.Content.ReadFromJsonAsync<DiscordGuildMemberResponse>(cancellationToken: cancellationToken)
			?? throw new InvalidOperationException("Failed to read Discord guild member response");
	}
}

public sealed class DiscordAuthResult
{
	public Platform Platform { get; init; }
	public required string ExternalUserId { get; init; }
	public required string Username { get; init; }
	public string? GlobalName { get; init; }
	public DateTimeOffset? JoinedAt { get; init; }
	public string[] RoleIds { get; init; } = Array.Empty<string>();
	public bool IsGuildMember { get; init; }
}

internal sealed class DiscordTokenResponse
{
	[JsonPropertyName("access_token")]
	public string AccessToken { get; init; } = string.Empty;

	[JsonPropertyName("token_type")]
	public string TokenType { get; init; } = string.Empty;

	[JsonPropertyName("expires_in")]
	public int ExpiresIn { get; init; }
}

internal sealed class DiscordUserResponse
{
	[JsonPropertyName("id")]
	public string Id { get; init; } = string.Empty;

	[JsonPropertyName("username")]
	public string Username { get; init; } = string.Empty;

	[JsonPropertyName("global_name")]
	public string? GlobalName { get; init; }
}

internal sealed class DiscordGuildMemberResponse
{
	[JsonPropertyName("joined_at")]
	public DateTimeOffset JoinedAt { get; init; }

	[JsonPropertyName("roles")]
	public string[] Roles { get; init; } = Array.Empty<string>();
}
