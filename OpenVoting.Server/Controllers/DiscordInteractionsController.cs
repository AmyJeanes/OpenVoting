using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NSec.Cryptography;
using OpenVoting.Server.Auth;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/discord")]
public sealed class DiscordInteractionsController : ControllerBase
{
	private const int InteractionTypePing = 1;
	private const int InteractionTypeApplicationCommand = 2;
	private const int ResponseTypePong = 1;
	private const int ResponseTypeChannelMessageWithSource = 4;
	private const int MessageFlagEphemeral = 1 << 6;

	private readonly DiscordSettings _discordSettings;
	private readonly IOneTimeLoginLinkService _oneTimeLoginLinkService;
	private readonly ILogger<DiscordInteractionsController> _logger;

	public DiscordInteractionsController(
		IOptions<Settings> settings,
		IOneTimeLoginLinkService oneTimeLoginLinkService,
		ILogger<DiscordInteractionsController> logger)
	{
		_discordSettings = settings.Value.Discord;
		_oneTimeLoginLinkService = oneTimeLoginLinkService;
		_logger = logger;
	}

	[HttpPost("interactions")]
	public async Task<ActionResult> Interactions(CancellationToken cancellationToken)
	{
		if (!TryGetSignatureHeaders(out var signatureHex, out var timestamp))
		{
			return Unauthorized();
		}

		if (string.IsNullOrWhiteSpace(_discordSettings.InteractionsPublicKey))
		{
			_logger.LogWarning("Discord interactions public key is not configured");
			return Unauthorized();
		}

		using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
		var body = await reader.ReadToEndAsync(cancellationToken);

		if (!IsValidDiscordSignature(_discordSettings.InteractionsPublicKey, signatureHex, timestamp, body))
		{
			_logger.LogWarning("Rejected Discord interaction with invalid signature");
			return Unauthorized();
		}

		var interaction = JsonSerializer.Deserialize<DiscordInteractionRequest>(body);
		if (interaction is null)
		{
			return BadRequest();
		}

		if (interaction.Type == InteractionTypePing)
		{
			return Ok(new { type = ResponseTypePong });
		}

		if (interaction.Type != InteractionTypeApplicationCommand)
		{
			return Ok(EphemeralResponse("Unsupported interaction type"));
		}

		if (!string.Equals(interaction.Data?.Name, "voting", StringComparison.OrdinalIgnoreCase))
		{
			return Ok(EphemeralResponse("Unknown command"));
		}

		if (interaction.Member?.User is null)
		{
			return Ok(EphemeralResponse("Run this command in the Discord server not in a DM to get your login link"));
		}

		var appBaseUrl = UriHelper.BuildAbsolute(Request.Scheme, Request.Host, Request.PathBase);
		var result = await _oneTimeLoginLinkService.IssueForDiscordUserAsync(
			new DiscordInteractionUserContext(
				interaction.Member.User.Id,
				interaction.Member.User.Username,
				interaction.Member.User.GlobalName,
				interaction.Member.Roles,
				interaction.Member.JoinedAt),
			appBaseUrl,
			cancellationToken);

		var ttlMinutes = Math.Clamp(_discordSettings.LoginLinkExpirationMinutes, 1, 60);
		return Ok(EphemeralResponse($"Your one-time login link (valid for {ttlMinutes} minutes): {result.LoginLink}\nDo not share this link"));
	}

	private bool TryGetSignatureHeaders(out string signatureHex, out string timestamp)
	{
		signatureHex = Request.Headers["X-Signature-Ed25519"].ToString();
		timestamp = Request.Headers["X-Signature-Timestamp"].ToString();
		return !string.IsNullOrWhiteSpace(signatureHex) && !string.IsNullOrWhiteSpace(timestamp);
	}

	private static bool IsValidDiscordSignature(string publicKeyHex, string signatureHex, string timestamp, string body)
	{
		byte[] publicKey;
		byte[] signature;

		try
		{
			publicKey = Convert.FromHexString(publicKeyHex);
			signature = Convert.FromHexString(signatureHex);
		}
		catch (FormatException)
		{
			return false;
		}

		if (publicKey.Length != 32 || signature.Length != 64)
		{
			return false;
		}

		var payloadBytes = Encoding.UTF8.GetBytes(timestamp + body);
		var algorithm = SignatureAlgorithm.Ed25519;
		var importedPublicKey = PublicKey.Import(algorithm, publicKey, KeyBlobFormat.RawPublicKey);
		return algorithm.Verify(importedPublicKey, payloadBytes, signature);
	}

	private static object EphemeralResponse(string content)
	{
		return new
		{
			type = ResponseTypeChannelMessageWithSource,
			data = new
			{
				content,
				flags = MessageFlagEphemeral
			}
		};
	}
}

public sealed class DiscordInteractionRequest
{
	[JsonPropertyName("type")]
	public int Type { get; init; }

	[JsonPropertyName("data")]
	public DiscordInteractionData? Data { get; init; }

	[JsonPropertyName("member")]
	public DiscordInteractionMember? Member { get; init; }
}

public sealed class DiscordInteractionData
{
	[JsonPropertyName("name")]
	public string Name { get; init; } = string.Empty;
}

public sealed class DiscordInteractionMember
{
	[JsonPropertyName("roles")]
	public string[] Roles { get; init; } = [];

	[JsonPropertyName("joined_at")]
	public DateTimeOffset? JoinedAt { get; init; }

	[JsonPropertyName("user")]
	public DiscordInteractionUser? User { get; init; }
}

public sealed class DiscordInteractionUser
{
	[JsonPropertyName("id")]
	public string Id { get; init; } = string.Empty;

	[JsonPropertyName("username")]
	public string Username { get; init; } = string.Empty;

	[JsonPropertyName("global_name")]
	public string? GlobalName { get; init; }
}