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

	private const int PublicImageSize = 512;
	private const int TeaserImageSize = 512;

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

		var query = _db.PollEntries.Where(e => e.PollId == pollId);

		var entries = await query
			   .OrderBy(e => e.CreatedAt)
			   .Select(e => new PollEntryResponse
			   {
				   Id = e.Id,
				   DisplayName = e.DisplayName,
				   Description = e.Description,
				   // Only expose unblurred asset IDs if admin, owner, or not in submission phase
			   OriginalAssetId = (authUser.IsAdmin || e.SubmittedByMemberId == member.Id || poll.Status != PollStatus.SubmissionOpen)
				   ? e.OriginalAssetId
				   : null,
				   TeaserAssetId = e.TeaserAssetId,
			   PublicAssetId = (authUser.IsAdmin || e.SubmittedByMemberId == member.Id || poll.Status != PollStatus.SubmissionOpen)
				   ? e.PublicAssetId
				   : null,
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
				_db.Assets.RemoveRange(_db.Assets.Where(a => assetIds.Contains(a.Id)));
			}
		}

		_db.VoteChoices.RemoveRange(_db.VoteChoices.Where(vc => vc.EntryId == entryId));
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

		var titleRequirement = poll.TitleRequirement;
		var descriptionRequirement = poll.DescriptionRequirement;
		var imageRequirement = poll.ImageRequirement;

		if (titleRequirement == FieldRequirement.Required && string.IsNullOrWhiteSpace(request.DisplayName))
		{
			return BadRequest("Display name is required");
		}

		if (descriptionRequirement == FieldRequirement.Required && string.IsNullOrWhiteSpace(request.Description))
		{
			return BadRequest("Description is required");
		}
		var hasImage = request.OriginalAssetId.HasValue && request.OriginalAssetId.Value != Guid.Empty;

		if (imageRequirement == FieldRequirement.Off && hasImage)
		{
			return BadRequest("Images are disabled for this poll");
		}

		if (imageRequirement == FieldRequirement.Required && !hasImage)
		{
			return BadRequest("An image is required for this poll");
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

		Asset? originalAsset = null;
		Asset? publicAsset = null;
		Asset? teaserAsset = null;

		if (hasImage)
		{
			originalAsset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == request.OriginalAssetId, cancellationToken);
			if (originalAsset is null)
			{
				return BadRequest("Original asset not found");
			}

			if (!originalAsset.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
			{
				return BadRequest("Original asset must be an image");
			}

			try
			{
				(publicAsset, teaserAsset) = await CreateDerivedAssetsAsync(originalAsset, cancellationToken);
			}
			catch (InvalidOperationException ex)
			{
				return BadRequest(ex.Message);
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Failed to create derived assets for entry in poll {PollId}", poll.Id);
				return Problem(statusCode: StatusCodes.Status500InternalServerError, detail: "Unable to process image. Please try again.");
			}

			ArgumentNullException.ThrowIfNull(publicAsset);
			ArgumentNullException.ThrowIfNull(teaserAsset);
		}

		var resolvedDisplayName = request.DisplayName?.Trim() ?? string.Empty;
		if (titleRequirement == FieldRequirement.Off || string.IsNullOrWhiteSpace(resolvedDisplayName))
		{
			resolvedDisplayName = string.IsNullOrWhiteSpace(poll.Title) ? "Entry" : poll.Title;
		}

		string? resolvedDescription = descriptionRequirement switch
		{
			FieldRequirement.Off => null,
			_ => string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim()
		};

		var entry = new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = member.Id,
			DisplayName = resolvedDisplayName,
			Description = resolvedDescription,
			OriginalAssetId = hasImage ? request.OriginalAssetId : null,
			TeaserAssetId = teaserAsset?.Id,
			PublicAssetId = publicAsset?.Id,
			CreatedAt = now,
			IsDisqualified = false
		};

		if (hasImage)
		{
			_db.Assets.AddRange(publicAsset!, teaserAsset!);
		}
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

	private async Task<(Asset PublicAsset, Asset TeaserAsset)> CreateDerivedAssetsAsync(Asset originalAsset, CancellationToken cancellationToken)
	{
		await using var source = await _assetStorage.OpenReadAsync(originalAsset.StorageKey, cancellationToken);
		await using var buffer = new MemoryStream();
		await source.CopyToAsync(buffer, cancellationToken);
		buffer.Position = 0;

		var created = new List<Asset>();
		try
		{
			var publicAsset = await _assetStorage.SaveAsync(
				buffer,
				"public.png",
				"image/png",
				cancellationToken,
				new AssetSaveOptions
				{
					RequireSquare = true,
					ResizeTo = PublicImageSize,
					NormalizeToPng = true
				});
			created.Add(publicAsset);

			buffer.Position = 0;

			var teaserAsset = await _assetStorage.SaveAsync(
				buffer,
				"teaser.png",
				"image/png",
				cancellationToken,
				new AssetSaveOptions
				{
					RequireSquare = true,
					ResizeTo = TeaserImageSize,
					ApplyBlur = true,
					NormalizeToPng = true
				});
			created.Add(teaserAsset);

			return (publicAsset, teaserAsset);
		}
		catch
		{
			foreach (var asset in created)
			{
				try
				{
					await _assetStorage.DeleteAsync(asset.StorageKey, cancellationToken);
				}
				catch (Exception cleanupEx)
				{
					_logger.LogWarning(cleanupEx, "Failed to clean up derived asset {StorageKey}", asset.StorageKey);
				}
			}

			throw;
		}
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
