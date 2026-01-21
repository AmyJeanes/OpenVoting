namespace OpenVoting.Data;

public sealed class Vote
{
  public Guid Id { get; set; }
  public Guid PollId { get; set; }
  public Poll Poll { get; set; } = null!;

  public Guid MemberId { get; set; }
  public CommunityMember Member { get; set; } = null!;
  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
  public DateTimeOffset? SubmittedAt { get; set; }
  public bool IsFinal { get; set; }
  public ICollection<VoteChoice> Choices { get; set; } = [];
}
