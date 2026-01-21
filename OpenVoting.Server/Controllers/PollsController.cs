using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class PollsController : ControllerBase
{
	private readonly ApplicationDbContext _db;
	private readonly ILogger<PollsController> _logger;

	public PollsController(ApplicationDbContext db, ILogger<PollsController> logger)
	{
		_db = db;
		_logger = logger;
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
			.Where(p => p.CommunityId == member.CommunityId && (p.Status == PollStatus.SubmissionOpen || p.Status == PollStatus.VotingOpen))
			.OrderBy(p => p.SubmissionOpensAt)
			.FirstOrDefaultAsync(cancellationToken);

		if (poll is null)
		{
			return NoContent();
		}

		var response = BuildPollResponse(poll, member, authUser.IsAdmin);
		return Ok(response);
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

		if (request.SubmissionOpensAt >= request.SubmissionClosesAt || request.VotingOpensAt >= request.VotingClosesAt || request.SubmissionClosesAt > request.VotingOpensAt)
		{
			return BadRequest("Invalid timeline ordering");
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
			SubmissionOpensAt = request.SubmissionOpensAt,
			SubmissionClosesAt = request.SubmissionClosesAt,
			VotingOpensAt = request.VotingOpensAt,
			VotingClosesAt = request.VotingClosesAt,
			MustHaveJoinedBefore = request.MustHaveJoinedBefore,
			RequiredRoleIdsJson = request.RequiredRoleIds is null ? null : JsonSerializer.Serialize(request.RequiredRoleIds),
			MaxSelections = request.MaxSelections,
			RequireRanking = requireRanking,
			MaxSubmissionsPerMember = request.MaxSubmissionsPerMember,
			HideEntriesUntilVoting = request.HideEntriesUntilVoting
		};

		_db.Polls.Add(poll);
		await _db.SaveChangesAsync(cancellationToken);

		return Ok(BuildPollResponse(poll, member, authUser.IsAdmin));
	}

	[HttpPost("{id:guid}/open-submissions")]
	public async Task<ActionResult<PollResponse>> OpenSubmissions(Guid id, CancellationToken cancellationToken)
	{
		return await Transition(id, PollStatus.Draft, PollStatus.SubmissionOpen, cancellationToken);
	}

	[HttpPost("{id:guid}/open-voting")]
	public async Task<ActionResult<PollResponse>> OpenVoting(Guid id, CancellationToken cancellationToken)
	{
		return await Transition(id, PollStatus.SubmissionOpen, PollStatus.VotingOpen, cancellationToken);
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
				if (now > poll.SubmissionClosesAt)
				{
					return BadRequest("Submission window already closed");
				}
				break;
			case PollStatus.VotingOpen:
				if (now < poll.VotingOpensAt)
				{
					poll.VotingOpensAt = now;
				}
				break;
			case PollStatus.Closed:
				poll.VotingClosesAt = now;
				break;
		}

		poll.Status = next;
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
		var canSubmit = poll.Status == PollStatus.SubmissionOpen && now >= poll.SubmissionOpensAt && now <= poll.SubmissionClosesAt && meetsRole && meetsJoin && notBanned;
		var canVote = poll.Status == PollStatus.VotingOpen && now >= poll.VotingOpensAt && now <= poll.VotingClosesAt && meetsRole && meetsJoin && notBanned;

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
			.ToDictionary(e => e.Id, e => e.DisplayName);

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

	private static List<PollWinnerResponse> ComputeApprovalWinners(Dictionary<Guid, string> entries, IEnumerable<Vote> votes)
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
			.Select(kvp => new PollWinnerResponse(kvp.Key, entries[kvp.Key], kvp.Value))
			.ToList();
	}

	private static List<PollWinnerResponse> ComputeIrvWinners(Dictionary<Guid, string> entries, IEnumerable<Vote> votes)
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
			.Select(kvp => new PollWinnerResponse(kvp.Key, entries[kvp.Key], kvp.Value))
			.ToList();
	}
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
	public DateTimeOffset SubmissionOpensAt { get; init; }
	public DateTimeOffset SubmissionClosesAt { get; init; }
	public DateTimeOffset VotingOpensAt { get; init; }
	public DateTimeOffset VotingClosesAt { get; init; }
	public DateTimeOffset? MustHaveJoinedBefore { get; init; }
	public string[]? RequiredRoleIds { get; init; }
	public int MaxSelections { get; init; } = 5;
	public bool RequireRanking { get; init; } = true;
	public int MaxSubmissionsPerMember { get; init; } = 1;
	public bool HideEntriesUntilVoting { get; init; } = true;
	public VotingMethod VotingMethod { get; init; } = VotingMethod.Approval;
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

public sealed record PollWinnerResponse(Guid EntryId, string DisplayName, int Votes);
