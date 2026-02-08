using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class PollsController : ControllerBase
{
	private readonly ApplicationDbContext _db;
	private readonly ILogger<PollsController> _logger;
	private readonly IAssetStorage _assetStorage;

	public PollsController(ApplicationDbContext db, ILogger<PollsController> logger, IAssetStorage assetStorage)
	{
		_db = db;
		_logger = logger;
		_assetStorage = assetStorage;
	}

	[HttpGet("current")]
	public async Task<ActionResult<PollResponse>> GetCurrent(CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls
			.Where(p => p.CommunityId == member.CommunityId && (p.Status == PollStatus.SubmissionOpen || p.Status == PollStatus.VotingOpen || p.Status == PollStatus.Review))
			.OrderBy(p => p.SubmissionOpensAt)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is not null)
		{
			await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);
		}

		// If nothing is active but caller is admin, surface the latest non-closed poll for management.
		if (poll is null && authUser.IsAdmin)
		{
			poll = await _db.Polls
				.Where(p => p.CommunityId == member.CommunityId && p.Status != PollStatus.Closed && p.Status != PollStatus.Cancelled)
				.OrderByDescending(p => p.CreatedAt)
				.FirstOrDefaultAsync(cancellationToken);
		}

		if (poll is null)
		{
			return NoContent();
		}

		var response = BuildPollResponse(poll, member, authUser.IsAdmin);
		return Ok(response);
	}

	[HttpGet("active")]
	public async Task<ActionResult<IReadOnlyList<PollResponse>>> GetActive(CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
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
			return NoContent();
		}

		var responses = polls.Select(p => BuildPollResponse(p, member, authUser.IsAdmin)).ToList();
		return Ok(responses);
	}

	[HttpGet("{id:guid}/summary")]
	public async Task<ActionResult<PollResponse>> GetSummary(Guid id, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	[HttpGet("history")]
	public async Task<ActionResult<IReadOnlyList<PollHistoryResponse>>> GetHistory(CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var polls = await _db.Polls
			.Where(p => p.CommunityId == member.CommunityId && p.Status == PollStatus.Closed)
			.Include(p => p.Entries)
			.Include(p => p.Votes).ThenInclude(v => v.Choices)
			.OrderByDescending(p => p.VotingClosesAt)
			.Take(20)
			.ToListAsync(cancellationToken);

		var results = polls.Select(BuildHistoryResponse).ToList();
		return Ok(results);
	}

	[HttpGet("{id:guid}")]
	public async Task<ActionResult<PollDetailResponse>> GetPoll(Guid id, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls
			.Where(p => p.Id == id && p.CommunityId == member.CommunityId)
			.Include(p => p.Entries).ThenInclude(e => e.SubmittedByMember)
			.Include(p => p.Votes).ThenInclude(v => v.Choices)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var isAdmin = authUser.IsAdmin;
		var isClosed = poll.Status == PollStatus.Closed;

		var winners = isClosed || isAdmin ? ComputeWinners(poll).ToList() : new List<PollWinnerResponse>();
		var entryVotes = poll.Votes.SelectMany(v => v.Choices).ToList();

		var entryData = poll.Entries
			.OrderBy(e => e.CreatedAt)
			.Select(e =>
			{
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
					e.DisplayName,
					e.Description,
					e.OriginalAssetId,
					e.TeaserAssetId,
					e.PublicAssetId,
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
			orderedEntries = ShuffleDeterministic(entryData, member.Id, poll.Id)
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
			Winners = winners,
			Entries = orderedEntries
		};

		return Ok(response);
	}

	[HttpGet("{id:guid}/tally")]
	public async Task<ActionResult<IReadOnlyList<VotingBreakdownEntryResponse>>> GetVotingBreakdown(Guid id, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls
			.Where(p => p.Id == id && p.CommunityId == member.CommunityId)
			.Include(p => p.Votes).ThenInclude(v => v.Choices)
			.Include(p => p.Entries)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is null)
		{
			return NotFound();
		}

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
					DisplayName = e.DisplayName,
					Approvals = approvals,
					RankCounts = rankGroups
				};
			})
			.ToList();

		return Ok(breakdown);
	}

	[HttpPost]
	public async Task<ActionResult<PollResponse>> Create([FromBody] CreatePollRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		if (string.IsNullOrWhiteSpace(request.Title))
		{
			return BadRequest("Title is required");
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

		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	[HttpPatch("{id:guid}")]
	public async Task<ActionResult<PollResponse>> Update(Guid id, [FromBody] UpdatePollMetadataRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
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

		if (request.VotingMethod.HasValue && request.VotingMethod.Value != poll.VotingMethod)
		{
			if (poll.LockedAt.HasValue || poll.Status == PollStatus.VotingOpen || poll.Status == PollStatus.Closed || poll.Status == PollStatus.Cancelled)
			{
				return BadRequest("Voting method is locked once voting starts");
			}

			poll.VotingMethod = request.VotingMethod.Value;
			hasChanges = true;
		}

		poll.RequireRanking = poll.VotingMethod == VotingMethod.IRV;

		if (!hasChanges)
		{
			return BadRequest("No changes provided");
		}

		await _db.SaveChangesAsync(cancellationToken);
		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	[HttpPatch("{id:guid}/submission-settings")]
	public async Task<ActionResult<PollResponse>> UpdateSubmissionSettings(Guid id, [FromBody] UpdateSubmissionSettingsRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		if (poll.Status != PollStatus.Draft && poll.Status != PollStatus.SubmissionOpen)
		{
			return BadRequest("Submission settings can only be changed while drafts or submissions are open");
		}

		var hasChanges = false;

		if (request.MaxSubmissionsPerMember.HasValue)
		{
			if (request.MaxSubmissionsPerMember.Value < 1)
			{
				return BadRequest("Max submissions per member must be at least 1");
			}

			poll.MaxSubmissionsPerMember = request.MaxSubmissionsPerMember.Value;
			hasChanges = true;
		}

		if (request.SubmissionClosesAt.HasValue)
		{
			if (request.SubmissionClosesAt.Value <= DateTimeOffset.UtcNow)
			{
				return BadRequest("Submission auto-close must be in the future");
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
			return BadRequest("No changes provided");
		}

		await _db.SaveChangesAsync(cancellationToken);
		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	[HttpPatch("{id:guid}/voting-settings")]
	public async Task<ActionResult<PollResponse>> UpdateVotingSettings(Guid id, [FromBody] UpdateVotingSettingsRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		if (poll.Status == PollStatus.Closed || poll.Status == PollStatus.Cancelled)
		{
			return BadRequest("Voting settings cannot be changed after closure");
		}

		var hasChanges = false;

		if (request.MaxSelections.HasValue)
		{
			if (request.MaxSelections.Value < 1)
			{
				return BadRequest("Max selections must be at least 1");
			}

			poll.MaxSelections = request.MaxSelections.Value;
			hasChanges = true;
		}

		if (request.VotingClosesAt.HasValue)
		{
			if (request.VotingClosesAt.Value <= DateTimeOffset.UtcNow)
			{
				return BadRequest("Voting auto-close must be in the future");
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
			return BadRequest("No changes provided");
		}

		await _db.SaveChangesAsync(cancellationToken);
		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	[HttpDelete("{id:guid}")]
	public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls
			.Include(p => p.Entries)
			.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
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

		return NoContent();
	}

	[HttpPost("{id:guid}/open-submissions")]
	public async Task<ActionResult<PollResponse>> OpenSubmissions(Guid id, CancellationToken cancellationToken)
	{
		return await Transition(id, PollStatus.Draft, PollStatus.SubmissionOpen, cancellationToken);
	}

	[HttpPost("{id:guid}/start-review")]
	public async Task<ActionResult<PollResponse>> StartReview(Guid id, CancellationToken cancellationToken)
	{
		return await Transition(id, PollStatus.SubmissionOpen, PollStatus.Review, cancellationToken);
	}

	[HttpPost("{id:guid}/open-voting")]
	public async Task<ActionResult<PollResponse>> OpenVoting(Guid id, CancellationToken cancellationToken)
	{
		return await Transition(id, PollStatus.Review, PollStatus.VotingOpen, cancellationToken);
	}

	[HttpPost("{id:guid}/close")]
	public async Task<ActionResult<PollResponse>> Close(Guid id, CancellationToken cancellationToken)
	{
		return await Transition(id, PollStatus.VotingOpen, PollStatus.Closed, cancellationToken);
	}

	private async Task<ActionResult<PollResponse>> Transition(Guid id, PollStatus expected, PollStatus next, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return Forbid();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == id && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		if (poll.Status != expected)
		{
			return BadRequest($"Poll must be in {expected} to transition");
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
		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
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
			return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
		}
		catch
		{
			return Array.Empty<string>();
		}
	}

	private List<PollWinnerResponse> ComputeWinners(Poll poll)
	{
		var eligibleEntries = poll.Entries
			.Where(e => !e.IsDisqualified)
			.ToDictionary(
				e => e.Id,
				e => new EntryInfo(e.DisplayName, e.PublicAssetId ?? e.TeaserAssetId ?? e.OriginalAssetId)
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
			.Select(kvp => new PollWinnerResponse(kvp.Key, entries[kvp.Key].DisplayName, kvp.Value, entries[kvp.Key].AssetId))
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

			// If all remaining are tied or there are no votes, stop.
			if (maxVotes == minVotes)
			{
				break;
			}

			// If someone has a majority, stop early.
			var totalVotes = roundCounts.Values.Sum();
			if (maxVotes > totalVotes / 2)
			{
				active.RemoveWhere(id => roundCounts[id] != maxVotes);
				break;
			}

			// Eliminate the lowest group and repeat.
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
			.Select(kvp => new PollWinnerResponse(kvp.Key, entries[kvp.Key].DisplayName, kvp.Value, entries[kvp.Key].AssetId))
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

	private readonly record struct EntryInfo(string DisplayName, Guid? AssetId);
}

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

public sealed record PollWinnerResponse(Guid EntryId, string DisplayName, int Votes, Guid? AssetId);

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
	public IReadOnlyList<PollWinnerResponse> Winners { get; init; } = Array.Empty<PollWinnerResponse>();
	public IReadOnlyList<PollDetailEntryResponse> Entries { get; init; } = Array.Empty<PollDetailEntryResponse>();
}

public sealed class PollDetailEntryResponse
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
	public int ApprovalVotes { get; init; }
	public IReadOnlyList<PollDetailRankCountResponse> RankCounts { get; init; } = Array.Empty<PollDetailRankCountResponse>();
	public bool IsWinner { get; init; }
	public int? Position { get; init; }
	public string SubmittedByDisplayName { get; init; } = string.Empty;
}

public sealed record PollDetailRankCountResponse(int Rank, int Votes);
