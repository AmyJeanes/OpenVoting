using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace OpenVoting.Server.Services;

public interface IDiscordCommandRegistrar
{
	Task RegisterVotingCommandAsync(CancellationToken cancellationToken);
}

public sealed class DiscordCommandRegistrar : IDiscordCommandRegistrar
{
	private const string VotingCommandName = "voting";
	private readonly HttpClient _httpClient;
	private readonly DiscordSettings _settings;
	private readonly ILogger<DiscordCommandRegistrar> _logger;

	public DiscordCommandRegistrar(HttpClient httpClient, IOptions<Settings> options, ILogger<DiscordCommandRegistrar> logger)
	{
		_httpClient = httpClient;
		_settings = options.Value.Discord;
		_logger = logger;
	}

	public async Task RegisterVotingCommandAsync(CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(_settings.ClientId)
			|| string.IsNullOrWhiteSpace(_settings.GuildId)
			|| string.IsNullOrWhiteSpace(_settings.BotToken))
		{
			_logger.LogInformation("Skipping Discord slash command registration because ClientId, GuildId, or BotToken is not configured");
			return;
		}

		var commandsPath = $"applications/{_settings.ClientId}/guilds/{_settings.GuildId}/commands";
		var existingResponse = await _httpClient.GetAsync(commandsPath, cancellationToken);
		if (!existingResponse.IsSuccessStatusCode)
		{
			var body = await existingResponse.Content.ReadAsStringAsync(cancellationToken);
			_logger.LogWarning("Failed to fetch existing Discord commands. Status: {StatusCode}, Body: {Body}", existingResponse.StatusCode, body);
			return;
		}

		var existing = await existingResponse.Content.ReadFromJsonAsync<List<DiscordApplicationCommand>>(cancellationToken: cancellationToken) ?? [];
		var votingCommand = existing.FirstOrDefault(c => c.Type == 1 && string.Equals(c.Name, VotingCommandName, StringComparison.OrdinalIgnoreCase));

		var upsertPayload = new DiscordUpsertCommandRequest
		{
			Name = VotingCommandName,
			Description = "Easily login to the voting app using your Discord account",
			Type = 1,
			DmPermission = false
		};

		HttpResponseMessage upsertResponse;
		if (votingCommand is null)
		{
			upsertResponse = await _httpClient.PostAsJsonAsync(commandsPath, upsertPayload, cancellationToken);
		}
		else
		{
			upsertResponse = await _httpClient.PatchAsJsonAsync($"{commandsPath}/{votingCommand.Id}", upsertPayload, cancellationToken);
		}

		if (!upsertResponse.IsSuccessStatusCode)
		{
			var body = await upsertResponse.Content.ReadAsStringAsync(cancellationToken);
			_logger.LogWarning("Failed to upsert Discord login command. Status: {StatusCode}, Body: {Body}", upsertResponse.StatusCode, body);
			return;
		}

		_logger.LogInformation("Discord /voting command registration is up to date");
	}

	private sealed class DiscordApplicationCommand
	{
		[JsonPropertyName("id")]
		public string Id { get; init; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; init; } = string.Empty;

		[JsonPropertyName("type")]
		public int Type { get; init; }
	}

	private sealed class DiscordUpsertCommandRequest
	{
		[JsonPropertyName("name")]
		public string Name { get; init; } = string.Empty;

		[JsonPropertyName("description")]
		public string Description { get; init; } = string.Empty;

		[JsonPropertyName("type")]
		public int Type { get; init; }

		[JsonPropertyName("dm_permission")]
		public bool DmPermission { get; init; }
	}
}

public sealed class DiscordCommandRegistrationHostedService : IHostedService
{
	private readonly IDiscordCommandRegistrar _registrar;
	private readonly ILogger<DiscordCommandRegistrationHostedService> _logger;

	public DiscordCommandRegistrationHostedService(IDiscordCommandRegistrar registrar, ILogger<DiscordCommandRegistrationHostedService> logger)
	{
		_registrar = registrar;
		_logger = logger;
	}

	public async Task StartAsync(CancellationToken cancellationToken)
	{
		try
		{
			await _registrar.RegisterVotingCommandAsync(cancellationToken);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Unhandled error while registering Discord slash commands at startup");
		}
	}

	public Task StopAsync(CancellationToken cancellationToken)
	{
		return Task.CompletedTask;
	}
}