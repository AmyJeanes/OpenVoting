namespace OpenVoting.Data;

public sealed class PollEntry
{
  public Guid Id { get; set; }
  public Guid PollId { get; set; }
  public Poll Poll { get; set; } = null!;

  public Guid SubmittedByMemberId { get; set; }
  public CommunityMember SubmittedByMember { get; set; } = null!;

  public string DisplayName { get; set; } = string.Empty;
  public string? Description { get; set; }

  public Guid? OriginalAssetId { get; set; }
  public Asset? OriginalAsset { get; set; }

  public Guid? TeaserAssetId { get; set; }
  public Asset? TeaserAsset { get; set; }

  public Guid? PublicAssetId { get; set; }
  public Asset? PublicAsset { get; set; }

  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
  public DateTimeOffset? LockedAt { get; set; }

  public bool IsDisqualified { get; set; }
  public string? DisqualificationReason { get; set; }
  public Guid? DisqualifiedByMemberId { get; set; }
  public CommunityMember? DisqualifiedByMember { get; set; }
  public DateTimeOffset? DisqualifiedAt { get; set; }

  public ICollection<VoteChoice> VoteChoices { get; set; } = [];
}
