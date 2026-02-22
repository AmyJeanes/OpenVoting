using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;
using OpenVoting.Server;
using NUnit.Framework;

namespace OpenVoting.Server.Tests;

public class TokenServiceTests
{
	private TokenService _tokenService = null!;
	private JwtSettings _jwtSettings = null!;

	[SetUp]
	public void Setup()
	{
		_jwtSettings = new JwtSettings
		{
			Issuer = "TestIssuer",
			Audience = "TestAudience",
			SigningKey = "super-secret-signing-key-for-tests-12345",
			ExpirationMinutes = 30
		};

		var settings = Options.Create(new Settings
		{
			Discord = new DiscordSettings
			{
				ClientId = "client",
				ClientSecret = "secret",
				GuildId = "guild"
			},
			Jwt = _jwtSettings
		});

		_tokenService = new TokenService(settings);
	}

	[Test]
	public void GenerateToken_ContainsExpectedClaims()
	{
		var member = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = Guid.NewGuid(),
			Platform = Platform.Discord,
			ExternalUserId = "1234",
			DisplayName = "Tester",
			JoinedAt = DateTimeOffset.UtcNow
		};

		var jwt = _tokenService.GenerateToken(member, isAdmin: true);

		var handler = new JwtSecurityTokenHandler
		{
			MapInboundClaims = false
		};
		var principal = handler.ValidateToken(jwt, new TokenValidationParameters
		{
			ValidateIssuer = true,
			ValidateAudience = true,
			ValidateIssuerSigningKey = true,
			ValidIssuer = _jwtSettings.Issuer,
			ValidAudience = _jwtSettings.Audience,
			IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(_jwtSettings.SigningKey)),
			ClockSkew = TimeSpan.Zero
		}, out _);

		Assert.That(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), Is.EqualTo(member.Id.ToString()));
		Assert.That(principal.FindFirstValue("communityId"), Is.EqualTo(member.CommunityId.ToString()));
		Assert.That(principal.FindFirstValue("platform"), Is.EqualTo(member.Platform.ToString()));
		Assert.That(principal.FindFirstValue("externalUserId"), Is.EqualTo(member.ExternalUserId));
		Assert.That(principal.FindFirstValue("name"), Is.EqualTo(member.DisplayName));
		Assert.That(principal.FindFirstValue("isAdmin"), Is.EqualTo("true"));
	}

	[Test]
	public void GenerateToken_RespectsExpiration()
	{
		var member = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = Guid.NewGuid(),
			Platform = Platform.Discord,
			ExternalUserId = "1234",
			DisplayName = "Tester",
			JoinedAt = DateTimeOffset.UtcNow
		};

		var jwt = _tokenService.GenerateToken(member);
		var token = new JwtSecurityTokenHandler().ReadJwtToken(jwt);

		Assert.That(token.ValidTo, Is.GreaterThan(DateTime.UtcNow));
		Assert.That(token.ValidTo, Is.LessThanOrEqualTo(DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationMinutes + 1)));
	}
}
