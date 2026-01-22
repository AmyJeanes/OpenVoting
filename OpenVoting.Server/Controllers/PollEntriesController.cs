using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/polls/{pollId:guid}/entries")]
[Authorize]
public sealed class PollEntriesController : ControllerBase
{
	private readonly ApplicationDbContext _db;
	private readonly ILogger<PollEntriesController> _logger;
	private readonly IAssetStorage _assetStorage;

	public PollEntriesController(ApplicationDbContext db, ILogger<PollEntriesController> logger, IAssetStorage assetStorage)
	{
		_db = db;
		_logger = logger;
		_assetStorage = assetStorage;
	}

	[HttpGet]
	public async Task<ActionResult<IReadOnlyList<PollEntryResponse>>> Get(Guid pollId, CancellationToken cancellationToken)
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

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var hideEntries = poll.HideEntriesUntilVoting && (poll.Status == PollStatus.SubmissionOpen || poll.Status == PollStatus.Review) && !authUser.IsAdmin;
		var query = _db.PollEntries.Where(e => e.PollId == pollId);
		if (hideEntries)
		{
			query = query.Where(e => e.SubmittedByMemberId == member.Id);
		}

		var entries = await query
			.OrderBy(e => e.CreatedAt)
			.Select(e => new PollEntryResponse
			{
				Id = e.Id,
				DisplayName = e.DisplayName,
				Description = e.Description,
				OriginalAssetId = e.OriginalAssetId,
				TeaserAssetId = e.TeaserAssetId,
				PublicAssetId = e.PublicAssetId,
				IsDisqualified = e.IsDisqualified,
				DisqualificationReason = e.DisqualificationReason,
				CreatedAt = e.CreatedAt,
				SubmittedByDisplayName = authUser.IsAdmin || poll.Status == PollStatus.Closed || e.SubmittedByMemberId == member.Id
					? e.SubmittedByMember.DisplayName
					: string.Empty,
				IsOwn = e.SubmittedByMemberId == member.Id
			})
			.ToListAsync(cancellationToken);

		if (entries.Count == 0)
		{
			return NoContent();
		}

		return Ok(entries);
	}

	[HttpDelete("{entryId:guid}")]
	public async Task<IActionResult> Delete(Guid pollId, Guid entryId, CancellationToken cancellationToken)
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

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var now = DateTimeOffset.UtcNow;
		var submissionWindowOpen = poll.Status == PollStatus.SubmissionOpen && now >= poll.SubmissionOpensAt && now <= poll.SubmissionClosesAt;

		var entry = await _db.PollEntries.FirstOrDefaultAsync(e => e.Id == entryId && e.PollId == pollId, cancellationToken);
		if (entry is null)
		{
			return NotFound();
		}

		var isOwner = entry.SubmittedByMemberId == member.Id;
		if (!authUser.IsAdmin)
		{
			if (!submissionWindowOpen)
			{
				return Problem(statusCode: StatusCodes.Status403Forbidden, detail: "Submissions are not open");
			}

			if (!isOwner)
			{
				return Forbid();
			}
		}

		var assetIds = new List<Guid?> { entry.OriginalAssetId, entry.TeaserAssetId, entry.PublicAssetId }
			.Where(id => id.HasValue && id.Value != Guid.Empty)
			.Select(id => id!.Value)
			.ToList();

		if (assetIds.Count > 0)
		{
			var assets = await _db.Assets
				.Where(a => assetIds.Contains(a.Id))
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
					_logger.LogWarning(ex, "Failed to delete blob {StorageKey} for entry {EntryId}", asset.StorageKey, entry.Id);
				}
			}

			if (assets.Count > 0)
			{
				await _db.Assets.Where(a => assetIds.Contains(a.Id)).ExecuteDeleteAsync(cancellationToken);
			}
		}

		await _db.VoteChoices.Where(vc => vc.EntryId == entryId).ExecuteDeleteAsync(cancellationToken);
		_db.PollEntries.Remove(entry);
		await _db.SaveChangesAsync(cancellationToken);

		return NoContent();
	}

	[HttpPost("{entryId:guid}/disqualify")]
	public async Task<ActionResult<PollEntryResponse>> Disqualify(Guid pollId, Guid entryId, [FromBody] DisqualifyEntryRequest request, CancellationToken cancellationToken)
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

		var entry = await _db.PollEntries
			.Include(e => e.Poll)
			.FirstOrDefaultAsync(e => e.Id == entryId && e.PollId == pollId && e.Poll.CommunityId == member.CommunityId, cancellationToken);

		if (entry is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, entry.Poll, _logger, cancellationToken);

		entry.IsDisqualified = true;
		entry.DisqualificationReason = string.IsNullOrWhiteSpace(request.Reason) ? "Disqualified by moderator" : request.Reason;

		await _db.SaveChangesAsync(cancellationToken);

		return Ok(new PollEntryResponse
		{
			Id = entry.Id,
			DisplayName = entry.DisplayName,
			Description = entry.Description,
			OriginalAssetId = entry.OriginalAssetId,
			TeaserAssetId = entry.TeaserAssetId,
			PublicAssetId = entry.PublicAssetId,
			IsDisqualified = entry.IsDisqualified,
			DisqualificationReason = entry.DisqualificationReason,
			CreatedAt = entry.CreatedAt
		});
	}

	[HttpPost("{entryId:guid}/requalify")]
	public async Task<ActionResult<PollEntryResponse>> Requalify(Guid pollId, Guid entryId, CancellationToken cancellationToken)
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

		var entry = await _db.PollEntries
			.Include(e => e.Poll)
			.FirstOrDefaultAsync(e => e.Id == entryId && e.PollId == pollId && e.Poll.CommunityId == member.CommunityId, cancellationToken);

		if (entry is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, entry.Poll, _logger, cancellationToken);

		entry.IsDisqualified = false;
		entry.DisqualificationReason = null;

		await _db.SaveChangesAsync(cancellationToken);

		return Ok(new PollEntryResponse
		{
			Id = entry.Id,
			DisplayName = entry.DisplayName,
			Description = entry.Description,
			OriginalAssetId = entry.OriginalAssetId,
			TeaserAssetId = entry.TeaserAssetId,
			PublicAssetId = entry.PublicAssetId,
			IsDisqualified = entry.IsDisqualified,
			DisqualificationReason = entry.DisqualificationReason,
			CreatedAt = entry.CreatedAt
		});
	}

	[HttpPost]
	public async Task<ActionResult<PollEntryResponse>> Submit(Guid pollId, [FromBody] SubmitEntryRequest request, CancellationToken cancellationToken)
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

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var submitCheck = CanSubmit(poll, member);
		if (!submitCheck.Allowed)
		{
			return Problem(statusCode: StatusCodes.Status403Forbidden, detail: submitCheck.Reason);
		}

		if (string.IsNullOrWhiteSpace(request.DisplayName))
		{
			return BadRequest("DisplayName is required");
		}

		if (request.OriginalAssetId == Guid.Empty)
		{
			return BadRequest("OriginalAssetId is required");
		}

		var now = DateTimeOffset.UtcNow;
		if (poll.Status != PollStatus.SubmissionOpen || now < poll.SubmissionOpensAt || now > poll.SubmissionClosesAt)
		{
			return Problem(statusCode: StatusCodes.Status403Forbidden, detail: "Submissions are not open");
		}

		var submissions = await _db.PollEntries.CountAsync(e => e.PollId == pollId && e.SubmittedByMemberId == member.Id, cancellationToken);
		if (submissions >= poll.MaxSubmissionsPerMember)
		{
			return Problem(statusCode: StatusCodes.Status400BadRequest, detail: "Submission limit reached for this poll");
		}

		var assetExists = await _db.Assets.AnyAsync(a => a.Id == request.OriginalAssetId, cancellationToken);
		if (!assetExists)
		{
			return BadRequest("Original asset not found");
		}

		if (request.TeaserAssetId.HasValue)
		{
			var teaserExists = await _db.Assets.AnyAsync(a => a.Id == request.TeaserAssetId.Value, cancellationToken);
			if (!teaserExists)
			{
				return BadRequest("Teaser asset not found");
			}
		}

		if (request.PublicAssetId.HasValue)
		{
			var publicExists = await _db.Assets.AnyAsync(a => a.Id == request.PublicAssetId.Value, cancellationToken);
			if (!publicExists)
			{
				return BadRequest("Public asset not found");
			}
		}

		var entry = new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = member.Id,
			DisplayName = request.DisplayName,
			Description = request.Description,
			OriginalAssetId = request.OriginalAssetId,
			TeaserAssetId = request.TeaserAssetId,
			PublicAssetId = request.PublicAssetId,
			CreatedAt = now,
			IsDisqualified = false
		};

		_db.PollEntries.Add(entry);
		await _db.SaveChangesAsync(cancellationToken);

		return Ok(new PollEntryResponse
		{
			Id = entry.Id,
			DisplayName = entry.DisplayName,
			Description = entry.Description,
			OriginalAssetId = entry.OriginalAssetId,
			TeaserAssetId = entry.TeaserAssetId,
			PublicAssetId = entry.PublicAssetId,
			IsDisqualified = entry.IsDisqualified,
			DisqualificationReason = entry.DisqualificationReason,
			CreatedAt = entry.CreatedAt
		});
	}

	private static EligibilityResult CanSubmit(Poll poll, CommunityMember member)
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

		if (poll.Status != PollStatus.SubmissionOpen || now < poll.SubmissionOpensAt || now > poll.SubmissionClosesAt)
		{
			return EligibilityResult.Deny("Submissions are not open");
		}

		return EligibilityResult.Allow();
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

public sealed class SubmitEntryRequest
{
	public string DisplayName { get; init; } = string.Empty;
	public string? Description { get; init; }
	public Guid OriginalAssetId { get; init; }
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
	public Guid OriginalAssetId { get; init; }
	public Guid? TeaserAssetId { get; init; }
	public Guid? PublicAssetId { get; init; }
	public bool IsDisqualified { get; init; }
	public string? DisqualificationReason { get; init; }
	public DateTimeOffset CreatedAt { get; init; }
	public string SubmittedByDisplayName { get; init; } = string.Empty;
	public bool IsOwn { get; init; }
}
