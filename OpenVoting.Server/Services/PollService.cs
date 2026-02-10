using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Contracts;

namespace OpenVoting.Server.Services;

public interface IPollService
{
	Task<PollResult<PollResponse>> GetCurrentAsync(ClaimsPrincipal user, CancellationToken cancellationToken);
	Task<PollResult<IReadOnlyList<PollResponse>>> GetActiveAsync(ClaimsPrincipal user, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> GetSummaryAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<IReadOnlyList<PollHistoryResponse>>> GetHistoryAsync(ClaimsPrincipal user, CancellationToken cancellationToken);
	Task<PollResult<PollDetailResponse>> GetPollAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>> GetVotingBreakdownAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> CreateAsync(ClaimsPrincipal user, CreatePollRequest request, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> UpdateMetadataAsync(ClaimsPrincipal user, Guid id, UpdatePollMetadataRequest request, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> UpdateSubmissionSettingsAsync(ClaimsPrincipal user, Guid id, UpdateSubmissionSettingsRequest request, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> UpdateVotingSettingsAsync(ClaimsPrincipal user, Guid id, UpdateVotingSettingsRequest request, CancellationToken cancellationToken);
	Task<PollResult<object?>> DeleteAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> OpenSubmissionsAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> StartReviewAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> OpenVotingAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
	Task<PollResult<PollResponse>> CloseAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken);
}

public sealed class PollService : IPollService
{
	private readonly ApplicationDbContext _db;
	private readonly ILogger<PollService> _logger;
	private readonly IAssetStorage _assetStorage;

	public PollService(ApplicationDbContext db, ILogger<PollService> logger, IAssetStorage assetStorage)
	{
		_db = db;
		_logger = logger;
		_assetStorage = assetStorage;
	}

	public async Task<PollResult<PollResponse>> GetCurrentAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var poll = await _db.Polls
			.Where(p => p.CommunityId == member.CommunityId && (p.Status == PollStatus.SubmissionOpen || p.Status == PollStatus.VotingOpen || p.Status == PollStatus.Review))
			.OrderBy(p => p.SubmissionOpensAt)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is not null)
		{
			await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);
		}

		if (poll is null && authUser.IsAdmin)
		{
			poll = await _db.Polls
				.Where(p => p.CommunityId == member.CommunityId && p.Status != PollStatus.Closed && p.Status != PollStatus.Cancelled)
				.OrderByDescending(p => p.CreatedAt)
				.FirstOrDefaultAsync(cancellationToken);
		}

		if (poll is null)
		{
			return PollResult<PollResponse>.NoContent();
		}

		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	public async Task<PollResult<IReadOnlyList<PollResponse>>> GetActiveAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollResult<IReadOnlyList<PollResponse>>.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollResult<IReadOnlyList<PollResponse>>.Unauthorized();
		}

		var query = _db.Polls
			.Where(p => p.CommunityId == member.CommunityId && p.Status != PollStatus.Closed && p.Status != PollStatus.Cancelled);

		if (!authUser.IsAdmin)
		{
			query = query.Where(p => p.Status == PollStatus.SubmissionOpen || p.Status == PollStatus.VotingOpen || p.Status == PollStatus.Review);
		}

		var polls = await query
			.OrderBy(p => p.SubmissionOpensAt)
			.ToListAsync(cancellationToken);

		foreach (var p in polls)
		{
			await PollAutoTransition.ApplyAsync(_db, p, _logger, cancellationToken);
		}

		if (polls.Count == 0)
		{
			return PollResult<IReadOnlyList<PollResponse>>.NoContent();
		}

		var responses = polls.Select(p => BuildPollResponse(p, member, authUser.IsAdmin)).ToList();
		return PollResult<IReadOnlyList<PollResponse>>.Ok(responses);
	}

	public async Task<PollResult<PollResponse>> GetSummaryAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		var (authUser, member) = await GetAuthMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member!.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollResult<PollResponse>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);
		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	public async Task<PollResult<IReadOnlyList<PollHistoryResponse>>> GetHistoryAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
	{
		var (authUser, member) = await GetAuthMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<IReadOnlyList<PollHistoryResponse>>.Unauthorized();
		}

		if (member is null)
		{
			return PollResult<IReadOnlyList<PollHistoryResponse>>.Unauthorized();
		}

		var polls = await _db.Polls
			.Where(p => p.CommunityId == member!.CommunityId && p.Status == PollStatus.Closed)
			.Include(p => p.Entries).ThenInclude(e => e.SubmittedByMember)
			.Include(p => p.Votes).ThenInclude(v => v.Choices)
			.OrderByDescending(p => p.VotingClosesAt)
			.Take(20)
			.ToListAsync(cancellationToken);

		var results = polls.Select(BuildHistoryResponse).ToList();
		return PollResult<IReadOnlyList<PollHistoryResponse>>.Ok(results);
	}

	public async Task<PollResult<PollDetailResponse>> GetPollAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		var (authUser, member) = await GetAuthMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<PollDetailResponse>.Unauthorized();
		}

		if (member is null)
		{
			return PollResult<PollDetailResponse>.Unauthorized();
		}

		var poll = await _db.Polls
			.Where(p => p.Id == id && p.CommunityId == member!.CommunityId)
			.Include(p => p.Entries).ThenInclude(e => e.SubmittedByMember)
			.Include(p => p.Votes).ThenInclude(v => v.Choices)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is null)
		{
			return PollResult<PollDetailResponse>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var isAdmin = authUser.IsAdmin;
		var isClosed = poll.Status == PollStatus.Closed;
		var winners = isClosed || isAdmin ? ComputeWinners(poll).ToList() : new List<PollWinnerResponse>();
		var entryVotes = poll.Votes.SelectMany(v => v.Choices).ToList();

		var hideTitles = poll.TitleRequirement == FieldRequirement.Off;
		var entryData = poll.Entries
			.OrderBy(e => e.CreatedAt)
			.Select(e =>
			{
				var entryDisplayName = hideTitles ? string.Empty : e.DisplayName;
				var canSeeFullAssets = isAdmin || e.SubmittedByMemberId == member!.Id || poll.Status != PollStatus.SubmissionOpen;
				var originalAssetId = canSeeFullAssets ? e.OriginalAssetId : null;
				var publicAssetId = canSeeFullAssets ? e.PublicAssetId : null;

				var approvals = entryVotes.Count(c => c.EntryId == e.Id);
				var rankGroups = entryVotes
					.Where(c => c.EntryId == e.Id && c.Rank.HasValue)
					.GroupBy(c => c.Rank!.Value)
					.Select(g => new PollDetailRankCountResponse(g.Key, g.Count()))
					.ToList();

				var shouldExposeTallies = isAdmin || isClosed;
				var shouldShowAuthor = isAdmin || isClosed;

				return new EntryData(
					e.Id,
					entryDisplayName,
					e.Description,
					originalAssetId,
					e.TeaserAssetId,
					publicAssetId,
					e.IsDisqualified,
					e.DisqualificationReason,
					e.CreatedAt,
					shouldExposeTallies ? approvals : 0,
					shouldExposeTallies ? rankGroups : new List<PollDetailRankCountResponse>(),
					shouldExposeTallies && winners.Any(w => w.EntryId == e.Id),
					shouldShowAuthor ? e.SubmittedByMember.DisplayName : string.Empty
				);
			})
			.ToList();

		List<PollDetailEntryResponse> orderedEntries;
		if (isClosed || isAdmin)
		{
			orderedEntries = entryData
				.OrderByDescending(ed => PrimaryScore(ed, poll.VotingMethod))
				.ThenBy(ed => ed.DisplayName, StringComparer.OrdinalIgnoreCase)
				.Select((ed, idx) => ToEntryResponse(ed, idx + 1))
				.ToList();
		}
		else
		{
			orderedEntries = ShuffleDeterministic(entryData, member!.Id, poll.Id)
				.Select(ed => ToEntryResponse(ed, null))
				.ToList();
		}

		var response = new PollDetailResponse
		{
			Id = poll.Id,
			Title = poll.Title,
			Description = poll.Description ?? string.Empty,
			Status = poll.Status,
			VotingMethod = poll.VotingMethod,
			SubmissionOpensAt = poll.SubmissionOpensAt,
			SubmissionClosesAt = poll.SubmissionClosesAt,
			VotingOpensAt = poll.VotingOpensAt,
			VotingClosesAt = poll.VotingClosesAt,
			HideEntriesUntilVoting = poll.HideEntriesUntilVoting,
			MaxSelections = poll.MaxSelections,
			RequireRanking = poll.RequireRanking,
			TitleRequirement = poll.TitleRequirement,
			DescriptionRequirement = poll.DescriptionRequirement,
			ImageRequirement = poll.ImageRequirement,
			Winners = winners,
			Entries = orderedEntries
		};

		return PollResult<PollDetailResponse>.Ok(response);
	}

	public async Task<PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>> GetVotingBreakdownAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>.Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>.Forbidden("Admin only");
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>.Unauthorized();
		}

		var poll = await _db.Polls
			.Where(p => p.Id == id && p.CommunityId == member.CommunityId)
			.Include(p => p.Votes).ThenInclude(v => v.Choices)
			.Include(p => p.Entries)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is null)
		{
			return PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>.NotFound();
		}

		var hideTitles = poll.TitleRequirement == FieldRequirement.Off;
		var entryVotes = poll.Votes.SelectMany(v => v.Choices).ToList();
		var breakdown = poll.Entries
			.OrderBy(e => e.CreatedAt)
			.Select(e =>
			{
				var approvals = entryVotes.Count(c => c.EntryId == e.Id);
				var rankGroups = entryVotes
					.Where(c => c.EntryId == e.Id && c.Rank.HasValue)
					.GroupBy(c => c.Rank!.Value)
					.Select(g => new PollDetailRankCountResponse(g.Key, g.Count()))
					.ToList();

				return new VotingBreakdownEntryResponse
				{
					EntryId = e.Id,
					DisplayName = hideTitles ? string.Empty : e.DisplayName,
					Approvals = approvals,
					RankCounts = rankGroups
				};
			})
			.ToList();

		return PollResult<IReadOnlyList<VotingBreakdownEntryResponse>>.Ok(breakdown);
	}

	public async Task<PollResult<PollResponse>> CreateAsync(ClaimsPrincipal user, CreatePollRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return PollResult<PollResponse>.Forbidden("Admin only");
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (string.IsNullOrWhiteSpace(request.Title))
		{
			return PollResult<PollResponse>.BadRequest("Title is required");
		}

		var requireRanking = request.VotingMethod == VotingMethod.IRV;
		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = member.CommunityId,
			Title = request.Title,
			Description = request.Description,
			Status = PollStatus.Draft,
			VotingMethod = request.VotingMethod,
			SubmissionOpensAt = DateTimeOffset.UtcNow,
			SubmissionClosesAt = DateTimeOffset.MaxValue,
			VotingOpensAt = DateTimeOffset.MaxValue,
			VotingClosesAt = DateTimeOffset.MaxValue,
			MustHaveJoinedBefore = null,
			RequiredRoleIdsJson = null,
			MaxSelections = 5,
			RequireRanking = requireRanking,
			MaxSubmissionsPerMember = 1,
			HideEntriesUntilVoting = true
		};

		_db.Polls.Add(poll);
		await _db.SaveChangesAsync(cancellationToken);

		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	public async Task<PollResult<PollResponse>> UpdateMetadataAsync(ClaimsPrincipal user, Guid id, UpdatePollMetadataRequest request, CancellationToken cancellationToken)
	{
		var (authUser, member, forbidden) = await GetAuthAdminMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (forbidden)
		{
			return PollResult<PollResponse>.Forbidden("Admin only");
		}

		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member!.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollResult<PollResponse>.NotFound();
		}

		var hasChanges = false;

		if (!string.IsNullOrWhiteSpace(request.Title) && !string.Equals(request.Title, poll.Title, StringComparison.Ordinal))
		{
			poll.Title = request.Title.Trim();
			hasChanges = true;
		}

		if (request.Description is not null && !string.Equals(request.Description, poll.Description, StringComparison.Ordinal))
		{
			poll.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
			hasChanges = true;
		}

		if (request.TitleRequirement.HasValue && request.TitleRequirement.Value != poll.TitleRequirement)
		{
			poll.TitleRequirement = request.TitleRequirement.Value;
			hasChanges = true;
		}

		if (request.DescriptionRequirement.HasValue && request.DescriptionRequirement.Value != poll.DescriptionRequirement)
		{
			poll.DescriptionRequirement = request.DescriptionRequirement.Value;
			hasChanges = true;
		}

		if (request.ImageRequirement.HasValue && request.ImageRequirement.Value != poll.ImageRequirement)
		{
			poll.ImageRequirement = request.ImageRequirement.Value;
			hasChanges = true;
		}

		if (request.VotingMethod.HasValue && request.VotingMethod.Value != poll.VotingMethod)
		{
			if (poll.LockedAt.HasValue || poll.Status == PollStatus.VotingOpen || poll.Status == PollStatus.Closed || poll.Status == PollStatus.Cancelled)
			{
				return PollResult<PollResponse>.BadRequest("Voting method is locked once voting starts");
			}

			poll.VotingMethod = request.VotingMethod.Value;
			hasChanges = true;
		}

		poll.RequireRanking = poll.VotingMethod == VotingMethod.IRV;

		if (!hasChanges)
		{
			return PollResult<PollResponse>.BadRequest("No changes provided");
		}

		await _db.SaveChangesAsync(cancellationToken);
		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	public async Task<PollResult<PollResponse>> UpdateSubmissionSettingsAsync(ClaimsPrincipal user, Guid id, UpdateSubmissionSettingsRequest request, CancellationToken cancellationToken)
	{
		var (authUser, member, forbidden) = await GetAuthAdminMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (forbidden)
		{
			return PollResult<PollResponse>.Forbidden("Admin only");
		}

		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member!.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollResult<PollResponse>.NotFound();
		}

		if (poll.Status != PollStatus.Draft && poll.Status != PollStatus.SubmissionOpen)
		{
			return PollResult<PollResponse>.BadRequest("Submission settings can only be changed while drafts or submissions are open");
		}

		var hasChanges = false;

		if (request.MaxSubmissionsPerMember.HasValue)
		{
			if (request.MaxSubmissionsPerMember.Value < 1)
			{
				return PollResult<PollResponse>.BadRequest("Max submissions per member must be at least 1");
			}

			poll.MaxSubmissionsPerMember = request.MaxSubmissionsPerMember.Value;
			hasChanges = true;
		}

		if (request.SubmissionClosesAt.HasValue)
		{
			if (request.SubmissionClosesAt.Value <= DateTimeOffset.UtcNow)
			{
				return PollResult<PollResponse>.BadRequest("Submission auto-close must be in the future");
			}

			poll.SubmissionClosesAt = request.SubmissionClosesAt.Value;
			hasChanges = true;
		}
		else if (request.ClearSubmissionClosesAt)
		{
			poll.SubmissionClosesAt = DateTimeOffset.MaxValue;
			hasChanges = true;
		}

		if (!hasChanges)
		{
			return PollResult<PollResponse>.BadRequest("No changes provided");
		}

		await _db.SaveChangesAsync(cancellationToken);
		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	public async Task<PollResult<PollResponse>> UpdateVotingSettingsAsync(ClaimsPrincipal user, Guid id, UpdateVotingSettingsRequest request, CancellationToken cancellationToken)
	{
		var (authUser, member, forbidden) = await GetAuthAdminMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (forbidden)
		{
			return PollResult<PollResponse>.Forbidden("Admin only");
		}

		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member!.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollResult<PollResponse>.NotFound();
		}

		if (poll.Status == PollStatus.Closed || poll.Status == PollStatus.Cancelled)
		{
			return PollResult<PollResponse>.BadRequest("Voting settings cannot be changed after closure");
		}

		var hasChanges = false;

		if (request.MaxSelections.HasValue)
		{
			if (request.MaxSelections.Value < 1)
			{
				return PollResult<PollResponse>.BadRequest("Max selections must be at least 1");
			}

			poll.MaxSelections = request.MaxSelections.Value;
			hasChanges = true;
		}

		if (request.VotingClosesAt.HasValue)
		{
			if (request.VotingClosesAt.Value <= DateTimeOffset.UtcNow)
			{
				return PollResult<PollResponse>.BadRequest("Voting auto-close must be in the future");
			}

			poll.VotingClosesAt = request.VotingClosesAt.Value;
			hasChanges = true;
		}
		else if (request.ClearVotingClosesAt)
		{
			poll.VotingClosesAt = DateTimeOffset.MaxValue;
			hasChanges = true;
		}

		poll.RequireRanking = poll.VotingMethod == VotingMethod.IRV;

		if (!hasChanges)
		{
			return PollResult<PollResponse>.BadRequest("No changes provided");
		}

		await _db.SaveChangesAsync(cancellationToken);
		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	public async Task<PollResult<object?>> DeleteAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		var (authUser, member, forbidden) = await GetAuthAdminMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<object?>.Unauthorized();
		}

		if (forbidden)
		{
			return PollResult<object?>.Forbidden("Admin only");
		}

		if (member is null)
		{
			return PollResult<object?>.Unauthorized();
		}

		var poll = await _db.Polls
			.Include(p => p.Entries)
			.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member!.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollResult<object?>.NotFound();
		}

		var entryAssetIds = poll.Entries
			.SelectMany(e => new[] { e.OriginalAssetId, e.TeaserAssetId, e.PublicAssetId })
			.Where(a => a.HasValue)
			.Select(a => a!.Value)
			.Distinct()
			.ToList();

		var voteIds = await _db.Votes.Where(v => v.PollId == id).Select(v => v.Id).ToListAsync(cancellationToken);
		if (voteIds.Count > 0)
		{
			await _db.VoteChoices.Where(vc => voteIds.Contains(vc.VoteId)).ExecuteDeleteAsync(cancellationToken);
		}

		await _db.Votes.Where(v => v.PollId == id).ExecuteDeleteAsync(cancellationToken);
		await _db.PollEntries.Where(e => e.PollId == id).ExecuteDeleteAsync(cancellationToken);
		await _db.Polls.Where(p => p.Id == id).ExecuteDeleteAsync(cancellationToken);

		if (entryAssetIds.Count > 0)
		{
			var assets = await _db.Assets
				.Where(a => entryAssetIds.Contains(a.Id))
				.Select(a => new { a.Id, a.StorageKey })
				.ToListAsync(cancellationToken);

			foreach (var asset in assets)
			{
				try
				{
					await _assetStorage.DeleteAsync(asset.StorageKey, cancellationToken);
				}
				catch (Exception ex)
				{
					_logger.LogWarning(ex, "Failed to delete blob {StorageKey}", asset.StorageKey);
				}
			}

			if (assets.Count > 0)
			{
				await _db.Assets.Where(a => entryAssetIds.Contains(a.Id)).ExecuteDeleteAsync(cancellationToken);
			}
		}

		return PollResult<object?>.NoContent();
	}

	public Task<PollResult<PollResponse>> OpenSubmissionsAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		return TransitionAsync(user, id, PollStatus.Draft, PollStatus.SubmissionOpen, cancellationToken);
	}

	public Task<PollResult<PollResponse>> StartReviewAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		return TransitionAsync(user, id, PollStatus.SubmissionOpen, PollStatus.Review, cancellationToken);
	}

	public Task<PollResult<PollResponse>> OpenVotingAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		return TransitionAsync(user, id, PollStatus.Review, PollStatus.VotingOpen, cancellationToken);
	}

	public Task<PollResult<PollResponse>> CloseAsync(ClaimsPrincipal user, Guid id, CancellationToken cancellationToken)
	{
		return TransitionAsync(user, id, PollStatus.VotingOpen, PollStatus.Closed, cancellationToken);
	}

	private async Task<PollResult<PollResponse>> TransitionAsync(ClaimsPrincipal user, Guid id, PollStatus expected, PollStatus next, CancellationToken cancellationToken)
	{
		var (authUser, member, forbidden) = await GetAuthAdminMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		if (forbidden)
		{
			return PollResult<PollResponse>.Forbidden("Admin only");
		}

		if (member is null)
		{
			return PollResult<PollResponse>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member!.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollResult<PollResponse>.NotFound();
		}

		if (poll.Status != expected)
		{
			return PollResult<PollResponse>.BadRequest($"Poll must be in {expected} to transition");
		}

		var now = DateTimeOffset.UtcNow;
		switch (next)
		{
			case PollStatus.SubmissionOpen:
				if (now < poll.SubmissionOpensAt)
				{
					poll.SubmissionOpensAt = now;
				}
				break;
			case PollStatus.Review:
				poll.SubmissionClosesAt = now;
				break;
			case PollStatus.VotingOpen:
				if (now < poll.VotingOpensAt)
				{
					poll.VotingOpensAt = now;
				}
				poll.SubmissionClosesAt = poll.SubmissionClosesAt == DateTimeOffset.MaxValue ? now : poll.SubmissionClosesAt;
				break;
			case PollStatus.Closed:
				poll.VotingClosesAt = now;
				break;
		}

		poll.Status = next;
		poll.RequireRanking = poll.VotingMethod == VotingMethod.IRV;
		if (next == PollStatus.VotingOpen)
		{
			poll.LockedAt = now;
		}

		await _db.SaveChangesAsync(cancellationToken);
		return PollResult<PollResponse>.Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	private async Task<(AuthenticatedUser? AuthUser, CommunityMember? Member)> GetAuthMemberAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return (null, null);
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		return (member is null ? null : authUser, member);
	}

	private async Task<(AuthenticatedUser? AuthUser, CommunityMember? Member, bool Forbidden)> GetAuthAdminMemberAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
	{
		var (authUser, member) = await GetAuthMemberAsync(user, cancellationToken);
		if (authUser is null)
		{
			return (null, null, false);
		}

		if (!authUser.IsAdmin)
		{
			return (authUser, member, true);
		}

		return (authUser, member, false);
	}

	private PollHistoryResponse BuildHistoryResponse(Poll poll)
	{
		var winners = ComputeWinners(poll);

		return new PollHistoryResponse
		{
			Id = poll.Id,
			Title = poll.Title,
			Status = poll.Status,
			VotingMethod = poll.VotingMethod,
			VotingClosesAt = poll.VotingClosesAt,
			Winners = winners
		};
	}

	private PollResponse BuildPollResponse(Poll poll, CommunityMember member, bool isAdmin)
	{
		var now = DateTimeOffset.UtcNow;
		var memberRoles = DeserializeRoles(member.RoleIdsJson);
		var requiredRoles = DeserializeRoles(poll.RequiredRoleIdsJson);

		var meetsRole = requiredRoles.Length == 0 || requiredRoles.All(r => memberRoles.Contains(r));
		var meetsJoin = !poll.MustHaveJoinedBefore.HasValue || member.JoinedAt <= poll.MustHaveJoinedBefore.Value;
		var notBanned = !member.IsBanned;

		var requireRanking = poll.VotingMethod == VotingMethod.IRV;
		var submissionWindowOpen = poll.Status == PollStatus.SubmissionOpen && now >= poll.SubmissionOpensAt && now <= poll.SubmissionClosesAt;
		var votingWindowOpen = poll.Status == PollStatus.VotingOpen && now >= poll.VotingOpensAt && now <= poll.VotingClosesAt;
		var canSubmit = submissionWindowOpen && meetsRole && meetsJoin && notBanned;
		var canVote = votingWindowOpen && meetsRole && meetsJoin && notBanned;

		return new PollResponse
		{
			Id = poll.Id,
			Title = poll.Title,
			Description = poll.Description,
			Status = poll.Status,
			VotingMethod = poll.VotingMethod,
			SubmissionOpensAt = poll.SubmissionOpensAt,
			SubmissionClosesAt = poll.SubmissionClosesAt,
			VotingOpensAt = poll.VotingOpensAt,
			VotingClosesAt = poll.VotingClosesAt,
			HideEntriesUntilVoting = poll.HideEntriesUntilVoting,
			MaxSelections = poll.MaxSelections,
			RequireRanking = requireRanking,
			MaxSubmissionsPerMember = poll.MaxSubmissionsPerMember,
			TitleRequirement = poll.TitleRequirement,
			DescriptionRequirement = poll.DescriptionRequirement,
			ImageRequirement = poll.ImageRequirement,
			MustHaveJoinedBefore = poll.MustHaveJoinedBefore,
			RequiredRoleIds = requiredRoles,
			CanSubmit = canSubmit,
			CanVote = canVote,
			IsAdmin = isAdmin
		};
	}

	private static string[] DeserializeRoles(string? json)
	{
		if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
		try
		{
			return System.Text.Json.JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
		}
		catch
		{
			return Array.Empty<string>();
		}
	}

	private List<PollWinnerResponse> ComputeWinners(Poll poll)
	{
		var hideTitles = poll.TitleRequirement == FieldRequirement.Off;
		var eligibleEntries = poll.Entries
			.Where(e => !e.IsDisqualified)
			.ToDictionary(
				e => e.Id,
				e => new EntryInfo(
					hideTitles ? string.Empty : e.DisplayName,
					e.PublicAssetId ?? e.TeaserAssetId ?? e.OriginalAssetId,
					e.SubmittedByMember?.DisplayName ?? string.Empty
				)
			);

		if (eligibleEntries.Count == 0)
		{
			return [];
		}

		return poll.VotingMethod switch
		{
			VotingMethod.IRV => ComputeIrvWinners(eligibleEntries, poll.Votes),
			_ => ComputeApprovalWinners(eligibleEntries, poll.Votes)
		};
	}

	private static List<PollWinnerResponse> ComputeApprovalWinners(Dictionary<Guid, EntryInfo> entries, IEnumerable<Vote> votes)
	{
		var counts = entries.ToDictionary(kvp => kvp.Key, _ => 0);

		foreach (var choice in votes.SelectMany(v => v.Choices))
		{
			if (entries.ContainsKey(choice.EntryId))
			{
				counts[choice.EntryId] += 1;
			}
		}

		var max = counts.Values.DefaultIfEmpty().Max();
		return counts
			.Where(kvp => kvp.Value == max)
			.Select(kvp => new PollWinnerResponse(kvp.Key, entries[kvp.Key].DisplayName, kvp.Value, entries[kvp.Key].AssetId, entries[kvp.Key].SubmittedByDisplayName))
			.ToList();
	}

	private static List<PollWinnerResponse> ComputeIrvWinners(Dictionary<Guid, EntryInfo> entries, IEnumerable<Vote> votes)
	{
		var active = new HashSet<Guid>(entries.Keys);
		var ballots = votes
			.Select(v => v.Choices
				.Where(c => c.Rank.HasValue && active.Contains(c.EntryId))
				.OrderBy(c => c.Rank!.Value)
				.Select(c => c.EntryId)
				.ToList())
			.Where(b => b.Count > 0)
			.ToList();

		if (ballots.Count == 0)
		{
			return [];
		}

		while (active.Count > 1)
		{
			var roundCounts = active.ToDictionary(id => id, _ => 0);

			foreach (var ballot in ballots)
			{
				var choice = ballot.FirstOrDefault(id => active.Contains(id));
				if (choice != Guid.Empty)
				{
					roundCounts[choice] += 1;
				}
			}

			var maxVotes = roundCounts.Values.Max();
			var minVotes = roundCounts.Values.Min();

			if (maxVotes == minVotes)
			{
				break;
			}

			var totalVotes = roundCounts.Values.Sum();
			if (maxVotes > totalVotes / 2)
			{
				active.RemoveWhere(id => roundCounts[id] != maxVotes);
				break;
			}

			var toRemove = roundCounts.Where(kvp => kvp.Value == minVotes).Select(kvp => kvp.Key).ToList();
			foreach (var id in toRemove)
			{
				active.Remove(id);
			}
		}

		var finalCounts = active.ToDictionary(id => id, _ => 0);
		foreach (var ballot in ballots)
		{
			var choice = ballot.FirstOrDefault(id => active.Contains(id));
			if (choice != Guid.Empty)
			{
				finalCounts[choice] += 1;
			}
		}

		var top = finalCounts.Values.DefaultIfEmpty().Max();
		return finalCounts
			.Where(kvp => kvp.Value == top)
			.Select(kvp => new PollWinnerResponse(kvp.Key, entries[kvp.Key].DisplayName, kvp.Value, entries[kvp.Key].AssetId, entries[kvp.Key].SubmittedByDisplayName))
			.ToList();
	}

	private static List<EntryData> ShuffleDeterministic(IReadOnlyList<EntryData> items, Guid memberId, Guid pollId)
	{
		var seed = HashCode.Combine(memberId, pollId);
		var random = new Random(seed);
		var list = items.ToList();
		for (var i = list.Count - 1; i > 0; i--)
		{
			var j = random.Next(i + 1);
			(list[i], list[j]) = (list[j], list[i]);
		}
		return list;
	}

	private static int PrimaryScore(EntryData entry, VotingMethod method)
	{
		return method == VotingMethod.IRV
			? entry.RankCounts.FirstOrDefault(rc => rc.Rank == 1)?.Votes ?? 0
			: entry.ApprovalVotes;
	}

	private static PollDetailEntryResponse ToEntryResponse(EntryData data, int? position)
	{
		return new PollDetailEntryResponse
		{
			Id = data.Id,
			DisplayName = data.DisplayName,
			Description = data.Description,
			OriginalAssetId = data.OriginalAssetId,
			TeaserAssetId = data.TeaserAssetId,
			PublicAssetId = data.PublicAssetId,
			IsDisqualified = data.IsDisqualified,
			DisqualificationReason = data.DisqualificationReason,
			CreatedAt = data.CreatedAt,
			ApprovalVotes = data.ApprovalVotes,
			RankCounts = data.RankCounts,
			IsWinner = data.IsWinner,
			Position = position,
			SubmittedByDisplayName = data.SubmittedByDisplayName
		};
	}

	private sealed record EntryData(
		Guid Id,
		string DisplayName,
		string? Description,
		Guid? OriginalAssetId,
		Guid? TeaserAssetId,
		Guid? PublicAssetId,
		bool IsDisqualified,
		string? DisqualificationReason,
		DateTimeOffset CreatedAt,
		int ApprovalVotes,
		List<PollDetailRankCountResponse> RankCounts,
		bool IsWinner,
		string SubmittedByDisplayName);

	private readonly record struct EntryInfo(string DisplayName, Guid? AssetId, string SubmittedByDisplayName);
}

public sealed record PollResult<T>(PollOutcome Outcome, T? Response, string? Message)
{
	public static PollResult<T> Ok(T response) => new(PollOutcome.Ok, response, null);
	public static PollResult<T> NoContent() => new(PollOutcome.NoContent, default, null);
	public static PollResult<T> NotFound() => new(PollOutcome.NotFound, default, null);
	public static PollResult<T> Unauthorized() => new(PollOutcome.Unauthorized, default, null);
	public static PollResult<T> Forbidden(string message) => new(PollOutcome.Forbidden, default, message);
	public static PollResult<T> BadRequest(string message) => new(PollOutcome.BadRequest, default, message);
}

public enum PollOutcome
{
	Ok,
	NoContent,
	NotFound,
	Unauthorized,
	Forbidden,
	BadRequest
}
