namespace OpenVoting.Data;

public sealed class OneTimeLoginToken
{
  public Guid Id { get; set; }
  public Guid CommunityMemberId { get; set; }
  public CommunityMember CommunityMember { get; set; } = null!;
  public required string TokenHash { get; set; }
  public DateTimeOffset ExpiresAt { get; set; }
  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
  public DateTimeOffset? UsedAt { get; set; }
  public DateTimeOffset? RevokedAt { get; set; }
}