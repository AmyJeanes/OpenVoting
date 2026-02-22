using OpenVoting.Data.Enums;

namespace OpenVoting.Server.Contracts;

public sealed class PollResponse
{
	public Guid Id { get; init; }
	public string Title { get; init; } = string.Empty;
	public string? Description { get; init; }
	public PollStatus Status { get; init; }
	public VotingMethod VotingMethod { get; init; }
	public DateTimeOffset SubmissionOpensAt { get; init; }
	public DateTimeOffset SubmissionClosesAt { get; init; }
	public DateTimeOffset VotingOpensAt { get; init; }
	public DateTimeOffset VotingClosesAt { get; init; }
	public bool HideEntriesUntilVoting { get; init; }
	public int MaxSelections { get; init; }
	public bool RequireRanking { get; init; }
	public int MaxSubmissionsPerMember { get; init; }
	public FieldRequirement TitleRequirement { get; init; }
	public FieldRequirement DescriptionRequirement { get; init; }
	public FieldRequirement ImageRequirement { get; init; }
	public DateTimeOffset? MustHaveJoinedBefore { get; init; }
	public IReadOnlyList<string> RequiredRoleIds { get; init; } = Array.Empty<string>();
	public bool CanSubmit { get; init; }
	public bool CanVote { get; init; }
	public bool IsAdmin { get; init; }
}

public sealed class CreatePollRequest
{
	public string Title { get; init; } = string.Empty;
	public string? Description { get; init; }
	public VotingMethod VotingMethod { get; init; } = VotingMethod.Approval;
}

public sealed class UpdatePollMetadataRequest
{
	public string? Title { get; init; }
	public string? Description { get; init; }
	public VotingMethod? VotingMethod { get; init; }
	public FieldRequirement? TitleRequirement { get; init; }
	public FieldRequirement? DescriptionRequirement { get; init; }
	public FieldRequirement? ImageRequirement { get; init; }
}

public sealed class UpdateSubmissionSettingsRequest
{
	public int? MaxSubmissionsPerMember { get; init; }
	public DateTimeOffset? SubmissionClosesAt { get; init; }
	public bool ClearSubmissionClosesAt { get; init; }
}

public sealed class UpdateVotingSettingsRequest
{
	public int? MaxSelections { get; init; }
	public DateTimeOffset? VotingClosesAt { get; init; }
	public bool ClearVotingClosesAt { get; init; }
}

public sealed class PollHistoryResponse
{
	public Guid Id { get; init; }
	public string Title { get; init; } = string.Empty;
	public PollStatus Status { get; init; }
	public VotingMethod VotingMethod { get; init; }
	public DateTimeOffset VotingClosesAt { get; init; }
	public IReadOnlyList<PollWinnerResponse> Winners { get; init; } = Array.Empty<PollWinnerResponse>();
}

public sealed class VotingBreakdownEntryResponse
{
	public Guid EntryId { get; init; }
	public string DisplayName { get; init; } = string.Empty;
	public int Approvals { get; init; }
	public IReadOnlyList<PollDetailRankCountResponse> RankCounts { get; init; } = Array.Empty<PollDetailRankCountResponse>();
}

public sealed record PollWinnerResponse(Guid EntryId, string DisplayName, int Votes, Guid? AssetId, string SubmittedByDisplayName);

public sealed class PollDetailResponse
{
	public Guid Id { get; init; }
	public string Title { get; init; } = string.Empty;
	public string Description { get; init; } = string.Empty;
	public PollStatus Status { get; init; }
	public VotingMethod VotingMethod { get; init; }
	public DateTimeOffset SubmissionOpensAt { get; init; }
	public DateTimeOffset SubmissionClosesAt { get; init; }
	public DateTimeOffset VotingOpensAt { get; init; }
	public DateTimeOffset VotingClosesAt { get; init; }
	public bool HideEntriesUntilVoting { get; init; }
	public int MaxSelections { get; init; }
	public bool RequireRanking { get; init; }
	public FieldRequirement TitleRequirement { get; init; }
	public FieldRequirement DescriptionRequirement { get; init; }
	public FieldRequirement ImageRequirement { get; init; }
	public IReadOnlyList<PollWinnerResponse> Winners { get; init; } = Array.Empty<PollWinnerResponse>();
	public IReadOnlyList<PollDetailEntryResponse> Entries { get; init; } = Array.Empty<PollDetailEntryResponse>();
}

public sealed class PollDetailEntryResponse
{
	public Guid Id { get; init; }
	public string DisplayName { get; init; } = string.Empty;
	public string? Description { get; init; }
	public Guid? OriginalAssetId { get; init; }
	public string? TeaserBlurHash { get; init; }
	public Guid? PublicAssetId { get; init; }
	public bool IsDisqualified { get; init; }
	public string? DisqualificationReason { get; init; }
	public string? DisqualifiedByDisplayName { get; init; }
	public DateTimeOffset? DisqualifiedAt { get; init; }
	public DateTimeOffset CreatedAt { get; init; }
	public int ApprovalVotes { get; init; }
	public IReadOnlyList<PollDetailRankCountResponse> RankCounts { get; init; } = Array.Empty<PollDetailRankCountResponse>();
	public bool IsWinner { get; init; }
	public int? Position { get; init; }
	public string SubmittedByDisplayName { get; init; } = string.Empty;
}

public sealed record PollDetailRankCountResponse(int Rank, int Votes);
