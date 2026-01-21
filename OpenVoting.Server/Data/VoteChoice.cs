namespace OpenVoting.Data;

public sealed class VoteChoice
{
  public Guid Id { get; set; }
  public Guid VoteId { get; set; }
  public Vote Vote { get; set; } = null!;

  public Guid EntryId { get; set; }
  public PollEntry Entry { get; set; } = null!;

  public int? Rank { get; set; }
}
