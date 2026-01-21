namespace OpenVoting.Data;

using OpenVoting.Data.Enums;

public sealed class Community
{
  public required Guid Id { get; set; }
  public required Platform Platform { get; set; }

  public required string ExternalCommunityId { get; set; }
  public required string Name { get; set; }

  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

  public ICollection<CommunityMember> Members { get; set; } = [];
  public ICollection<Poll> Polls { get; set; } = [];
}
