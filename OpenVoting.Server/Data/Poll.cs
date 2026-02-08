namespace OpenVoting.Data;

using OpenVoting.Data.Enums;

public sealed class Poll
{
  public Guid Id { get; set; }
  public Guid CommunityId { get; set; }
  public Community Community { get; set; } = null!;

  public string Title { get; set; } = string.Empty;
  public string? Description { get; set; }

  public PollStatus Status { get; set; } = PollStatus.Draft;
  public VotingMethod VotingMethod { get; set; } = VotingMethod.Approval;

  public DateTimeOffset SubmissionOpensAt { get; set; }
  public DateTimeOffset SubmissionClosesAt { get; set; }
  public DateTimeOffset VotingOpensAt { get; set; }
  public DateTimeOffset VotingClosesAt { get; set; }

  public DateTimeOffset? MustHaveJoinedBefore { get; set; }
  public string? RequiredRoleIdsJson { get; set; }

  public int MaxSelections { get; set; } = 5;
  public bool RequireRanking { get; set; } = true;

  public FieldRequirement TitleRequirement { get; set; } = FieldRequirement.Required;
  public FieldRequirement DescriptionRequirement { get; set; } = FieldRequirement.Optional;
  public FieldRequirement ImageRequirement { get; set; } = FieldRequirement.Required;

  public int MaxSubmissionsPerMember { get; set; } = 1;
  public bool HideEntriesUntilVoting { get; set; } = true;

  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
  public DateTimeOffset? LockedAt { get; set; }

  public ICollection<PollEntry> Entries { get; set; } = [];
  public ICollection<Vote> Votes { get; set; } = [];
}
