namespace OpenVoting.Server.Contracts;

public sealed class SubmitVoteRequest
{
	public List<VoteSelection> Choices { get; init; } = [];
}

public sealed class VoteSelection
{
	public Guid EntryId { get; init; }
	public int? Rank { get; init; }
}

public sealed class VoteResponse
{
	public Guid VoteId { get; init; }
	public Guid PollId { get; init; }
	public Guid MemberId { get; init; }
	public bool IsFinal { get; init; }
	public DateTimeOffset? SubmittedAt { get; init; }
	public IReadOnlyList<VoteChoiceResponse> Choices { get; init; } = Array.Empty<VoteChoiceResponse>();
}

public sealed class VoteChoiceResponse
{
	public Guid EntryId { get; init; }
	public int? Rank { get; init; }
}
