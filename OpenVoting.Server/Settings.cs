namespace OpenVoting.Server;

public sealed class Settings
{
	public DiscordSettings Discord { get; init; } = new();
	public JwtSettings Jwt { get; init; } = new();
	public BlobStorageSettings BlobStorage { get; init; } = new();
	public string ServerName { get; init; } = "OpenVoting";
}

public sealed class DiscordSettings
{
	public string ClientId { get; init; } = string.Empty;
	public string ClientSecret { get; init; } = string.Empty;
	public string RedirectUri { get; init; } = string.Empty;
	public string GuildId { get; init; } = string.Empty;
	public string[] AdminRoleIds { get; init; } = Array.Empty<string>();
}

public sealed class JwtSettings
{
	public string Issuer { get; init; } = string.Empty;
	public string Audience { get; init; } = string.Empty;
	public string SigningKey { get; init; } = string.Empty;
	public int ExpirationMinutes { get; init; } = 60;
}

public sealed class BlobStorageSettings
{
	public string ConnectionString { get; init; } = string.Empty;
	public string ContainerName { get; init; } = "assets";
	public string? PublicBaseUrl { get; init; }
}
