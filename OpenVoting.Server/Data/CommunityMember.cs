namespace OpenVoting.Data;

using OpenVoting.Data.Enums;

public sealed class CommunityMember
{
  public Guid Id { get; set; }
  public Guid CommunityId { get; set; }
  public Community Community { get; set; } = null!;

  public Platform Platform { get; set; }
  public required string ExternalUserId { get; set; }
  public string DisplayName { get; set; } = string.Empty;

  public string RoleIdsJson { get; set; } = "[]";

  public DateTimeOffset JoinedAt { get; set; }

  public bool IsBanned { get; set; }

  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

  public ICollection<PollEntry> Entries { get; set; } = [];
  public ICollection<Vote> Votes { get; set; } = [];
}
