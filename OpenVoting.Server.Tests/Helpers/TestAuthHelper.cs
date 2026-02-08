using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace OpenVoting.Server.Tests.Helpers;

internal static class TestAuthHelper
{
	public static ClaimsPrincipal CreatePrincipal(Guid memberId, Guid communityId, bool isAdmin = false, string externalUserId = "external", string platform = "Discord", string displayName = "Tester")
	{
		var identity = new ClaimsIdentity(
			new[]
			{
				new Claim(JwtRegisteredClaimNames.Sub, memberId.ToString()),
				new Claim("communityId", communityId.ToString()),
				new Claim("externalUserId", externalUserId),
				new Claim("platform", platform),
				new Claim("name", displayName),
				new Claim("isAdmin", isAdmin ? "true" : "false")
			},
			"TestAuth");

		return new ClaimsPrincipal(identity);
	}
}
