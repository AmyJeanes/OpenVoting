using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenVoting.Data;
using OpenVoting.Data.Enums;

namespace OpenVoting.Server.Auth;

public sealed class TokenService
{
	private readonly JwtSettings _jwtSettings;

	public TokenService(IOptions<Settings> settings)
	{
		_jwtSettings = settings.Value.Jwt;
	}

	public string GenerateToken(CommunityMember member, bool isAdmin = false)
	{
		var handler = new JwtSecurityTokenHandler();
		var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SigningKey));
		var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

		var claims = new List<Claim>
		{
			new(JwtRegisteredClaimNames.Sub, member.Id.ToString()),
			new("communityId", member.CommunityId.ToString()),
			new("platform", member.Platform.ToString()),
			new("externalUserId", member.ExternalUserId),
			new("name", member.DisplayName),
			new("isAdmin", isAdmin ? "true" : "false")
		};

		var descriptor = new SecurityTokenDescriptor
		{
			Subject = new ClaimsIdentity(claims),
			Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationMinutes),
			Issuer = _jwtSettings.Issuer,
			Audience = _jwtSettings.Audience,
			SigningCredentials = credentials
		};

		var token = handler.CreateToken(descriptor);
		return handler.WriteToken(token);
	}
}

public sealed class AuthenticatedUser
{
	public Guid MemberId { get; init; }
	public Guid CommunityId { get; init; }
	public string ExternalUserId { get; init; } = string.Empty;
	public string Platform { get; init; } = string.Empty;
	public string DisplayName { get; init; } = string.Empty;
	public bool IsAdmin { get; init; }

	public static AuthenticatedUser? FromPrincipal(ClaimsPrincipal principal)
	{
		var memberId = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
		var communityId = principal.FindFirstValue("communityId");
		if (!Guid.TryParse(memberId, out var parsedMember) || !Guid.TryParse(communityId, out var parsedCommunity))
		{
			return null;
		}

		return new AuthenticatedUser
		{
			MemberId = parsedMember,
			CommunityId = parsedCommunity,
			ExternalUserId = principal.FindFirstValue("externalUserId") ?? string.Empty,
			Platform = principal.FindFirstValue("platform") ?? string.Empty,
			DisplayName = principal.FindFirstValue("name") ?? principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
			IsAdmin = string.Equals(principal.FindFirstValue("isAdmin"), "true", StringComparison.OrdinalIgnoreCase)
		};
	}
}
