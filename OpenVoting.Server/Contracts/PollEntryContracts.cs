namespace OpenVoting.Server.Contracts;

public sealed class SubmitEntryRequest
{
	public string DisplayName { get; init; } = string.Empty;
	public string? Description { get; init; }
	public Guid? OriginalAssetId { get; init; }
	public Guid? TeaserAssetId { get; init; }
	public Guid? PublicAssetId { get; init; }
}

public sealed class DisqualifyEntryRequest
{
	public string? Reason { get; init; }
}

public sealed class PollEntryResponse
{
	public Guid Id { get; init; }
	public string DisplayName { get; init; } = string.Empty;
	public string? Description { get; init; }
	public Guid? OriginalAssetId { get; init; }
	public Guid? TeaserAssetId { get; init; }
	public Guid? PublicAssetId { get; init; }
	public bool IsDisqualified { get; init; }
	public string? DisqualificationReason { get; init; }
	public DateTimeOffset CreatedAt { get; init; }
	public string SubmittedByDisplayName { get; init; } = string.Empty;
	public bool IsOwn { get; init; }
}
