using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Contracts;

namespace OpenVoting.Server.Services;

public interface IVoteService
{
	Task<VoteServiceResult> GetAsync(ClaimsPrincipal user, Guid pollId, CancellationToken cancellationToken);
	Task<VoteServiceResult> SubmitAsync(ClaimsPrincipal user, Guid pollId, SubmitVoteRequest request, CancellationToken cancellationToken);
}

public sealed class VoteService : IVoteService
{
	private readonly ApplicationDbContext _db;
	private readonly ILogger<VoteService> _logger;

	public VoteService(ApplicationDbContext db, ILogger<VoteService> logger)
	{
		_db = db;
		_logger = logger;
	}

	public async Task<VoteServiceResult> GetAsync(ClaimsPrincipal user, Guid pollId, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return VoteServiceResult.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return VoteServiceResult.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return VoteServiceResult.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var vote = await _db.Votes
			.Include(v => v.Choices)
			.FirstOrDefaultAsync(v => v.PollId == pollId && v.MemberId == member.Id, cancellationToken);

		if (vote is null)
		{
			return VoteServiceResult.NoContent();
		}

		return VoteServiceResult.Ok(ToResponse(vote));
	}

	public async Task<VoteServiceResult> SubmitAsync(ClaimsPrincipal user, Guid pollId, SubmitVoteRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return VoteServiceResult.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return VoteServiceResult.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return VoteServiceResult.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var voteCheck = CanVote(poll, member);
		if (!voteCheck.Allowed)
		{
			return VoteServiceResult.Forbidden(voteCheck.Reason ?? "Voting is not allowed");
		}

		if (request.Choices is null || request.Choices.Count == 0)
		{
			return VoteServiceResult.BadRequest("At least one choice is required");
		}

		if (request.Choices.Count > poll.MaxSelections)
		{
			return VoteServiceResult.BadRequest($"You can select at most {poll.MaxSelections} entries");
		}

		var distinctEntries = request.Choices.Select(c => c.EntryId).Distinct().ToList();
		if (distinctEntries.Count != request.Choices.Count)
		{
			return VoteServiceResult.BadRequest("Duplicate entries are not allowed");
		}

		var eligibleEntries = await _db.PollEntries
			.Where(e => e.PollId == pollId && distinctEntries.Contains(e.Id) && !e.IsDisqualified)
			.Select(e => e.Id)
			.ToListAsync(cancellationToken);

		if (eligibleEntries.Count != distinctEntries.Count)
		{
			return VoteServiceResult.BadRequest("One or more entries are invalid or disqualified");
		}

		var requireRanking = poll.VotingMethod == VotingMethod.IRV;
		if (requireRanking)
		{
			var ranks = request.Choices.Select(c => c.Rank).ToList();
			if (ranks.Any(r => !r.HasValue))
			{
				return VoteServiceResult.BadRequest("Ranks are required when ranking is enabled");
			}

			var rankValues = ranks!.Select(r => r!.Value).ToList();
			if (rankValues.Min() < 1 || rankValues.Max() > request.Choices.Count || rankValues.Distinct().Count() != rankValues.Count)
			{
				return VoteServiceResult.BadRequest("Ranks must be unique and between 1 and the number of choices");
			}
		}
		else if (request.Choices.Any(c => c.Rank.HasValue))
		{
			return VoteServiceResult.BadRequest("Ranks are not accepted for this poll");
		}

		var vote = await _db.Votes.FirstOrDefaultAsync(v => v.PollId == pollId && v.MemberId == member.Id, cancellationToken);
		var now = DateTimeOffset.UtcNow;

		if (vote is null)
		{
			vote = new Vote
			{
				Id = Guid.NewGuid(),
				PollId = poll.Id,
				MemberId = member.Id,
				CreatedAt = now,
				IsFinal = true,
				SubmittedAt = now
			};

			_db.Votes.Add(vote);
		}
		else
		{
			vote.SubmittedAt = now;
			vote.IsFinal = true;

			await _db.VoteChoices.Where(vc => vc.VoteId == vote.Id).ExecuteDeleteAsync(cancellationToken);
		}

		var choices = request.Choices
			.Select(c => new VoteChoice
			{
				Id = Guid.NewGuid(),
				VoteId = vote.Id,
				EntryId = c.EntryId,
				Rank = c.Rank
			})
			.ToList();

		_db.VoteChoices.AddRange(choices);
		vote.Choices = choices;

		await _db.SaveChangesAsync(cancellationToken);

		return VoteServiceResult.Ok(ToResponse(vote));
	}

	private static EligibilityResult CanVote(Poll poll, CommunityMember member)
	{
		var now = DateTimeOffset.UtcNow;
		var memberRoles = DeserializeRoles(member.RoleIdsJson);
		var requiredRoles = DeserializeRoles(poll.RequiredRoleIdsJson);

		if (member.IsBanned)
		{
			return EligibilityResult.Deny("Member is banned");
		}

		if (requiredRoles.Length > 0 && !requiredRoles.All(r => memberRoles.Contains(r)))
		{
			return EligibilityResult.Deny("Missing required roles for this poll");
		}

		if (poll.MustHaveJoinedBefore.HasValue && member.JoinedAt >= poll.MustHaveJoinedBefore.Value)
		{
			return EligibilityResult.Deny("Join date is after the allowed cutoff");
		}

		if (poll.Status != PollStatus.VotingOpen || now < poll.VotingOpensAt || now > poll.VotingClosesAt)
		{
			return EligibilityResult.Deny("Voting is not open");
		}

		return EligibilityResult.Allow();
	}

	private static VoteResponse ToResponse(Vote vote)
	{
		return new VoteResponse
		{
			VoteId = vote.Id,
			PollId = vote.PollId,
			MemberId = vote.MemberId,
			IsFinal = vote.IsFinal,
			SubmittedAt = vote.SubmittedAt,
			Choices = vote.Choices
				.Select(c => new VoteChoiceResponse
				{
					EntryId = c.EntryId,
					Rank = c.Rank
				})
				.ToList()
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

	private readonly record struct EligibilityResult(bool Allowed, string? Reason)
	{
		public static EligibilityResult Allow() => new(true, null);
		public static EligibilityResult Deny(string reason) => new(false, reason);
	}
}

public sealed record VoteServiceResult(VoteServiceOutcome Outcome, VoteResponse? Response, string? Message)
{
	public static VoteServiceResult Ok(VoteResponse response) => new(VoteServiceOutcome.Ok, response, null);
	public static VoteServiceResult NoContent() => new(VoteServiceOutcome.NoContent, null, null);
	public static VoteServiceResult NotFound() => new(VoteServiceOutcome.NotFound, null, null);
	public static VoteServiceResult Unauthorized() => new(VoteServiceOutcome.Unauthorized, null, null);
	public static VoteServiceResult Forbidden(string message) => new(VoteServiceOutcome.Forbidden, null, message);
	public static VoteServiceResult BadRequest(string message) => new(VoteServiceOutcome.BadRequest, null, message);
}

public enum VoteServiceOutcome
{
	Ok,
	NoContent,
	NotFound,
	Unauthorized,
	Forbidden,
	BadRequest
}
