using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace OpenVoting.Server.Services;

public interface IDiscordGuildService
{
	Task<DiscordGuildInfo?> GetGuildInfoAsync(CancellationToken cancellationToken);
}

public sealed class DiscordGuildService : IDiscordGuildService
{
	private const string CacheKey = "discord-guild-info";
	private readonly HttpClient _httpClient;
	private readonly DiscordSettings _settings;
	private readonly IMemoryCache _cache;
	private readonly ILogger<DiscordGuildService> _logger;

	public DiscordGuildService(HttpClient httpClient, IOptions<Settings> options, IMemoryCache cache, ILogger<DiscordGuildService> logger)
	{
		_httpClient = httpClient;
		_settings = options.Value.Discord;
		_cache = cache;
		_logger = logger;
	}

	public async Task<DiscordGuildInfo?> GetGuildInfoAsync(CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(_settings.GuildId))
		{
			_logger.LogWarning("Discord GuildId not configured; skipping guild lookup");
			return null;
		}

		if (string.IsNullOrWhiteSpace(_settings.BotToken))
		{
			_logger.LogWarning("Discord bot token not configured; skipping guild lookup");
			return null;
		}

		if (_cache.TryGetValue(CacheKey, out DiscordGuildInfo? cached))
		{
			return cached;
		}

		try
		{
			var response = await _httpClient.GetAsync($"guilds/{_settings.GuildId}", cancellationToken);
			if (!response.IsSuccessStatusCode)
			{
				_logger.LogWarning("Failed to fetch Discord guild {GuildId}. Status: {StatusCode}", _settings.GuildId, response.StatusCode);
				return null;
			}

			var payload = await response.Content.ReadFromJsonAsync<DiscordGuildResponse>(cancellationToken: cancellationToken);
			if (payload is null)
			{
				_logger.LogWarning("Discord guild response was empty for guild {GuildId}", _settings.GuildId);
				return null;
			}

			var iconUrl = string.IsNullOrWhiteSpace(payload.Icon)
				? null
				: $"https://cdn.discordapp.com/icons/{payload.Id}/{payload.Icon}.png?size=256";

			var guild = new DiscordGuildInfo(payload.Id, payload.Name, iconUrl);
			_cache.Set(CacheKey, guild, TimeSpan.FromMinutes(10));
			return guild;
		}
		catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
		{
			_logger.LogWarning(ex, "Error while fetching Discord guild {GuildId}", _settings.GuildId);
			return null;
		}
	}

	private sealed class DiscordGuildResponse
	{
		[JsonPropertyName("id")]
		public string Id { get; init; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; init; } = string.Empty;

		[JsonPropertyName("icon")]
		public string? Icon { get; init; }
	}
}

public sealed record DiscordGuildInfo(string Id, string Name, string? IconUrl);
