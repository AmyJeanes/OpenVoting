using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Contracts;

namespace OpenVoting.Server.Services;

public interface IPollEntryService
{
	Task<PollEntryResult<IReadOnlyList<PollEntryResponse>>> GetAsync(ClaimsPrincipal user, Guid pollId, CancellationToken cancellationToken);
	Task<PollEntryResult<PollEntryResponse>> SubmitAsync(ClaimsPrincipal user, Guid pollId, SubmitEntryRequest request, CancellationToken cancellationToken);
	Task<PollEntryResult<PollEntryResponse>> DisqualifyAsync(ClaimsPrincipal user, Guid pollId, Guid entryId, DisqualifyEntryRequest request, CancellationToken cancellationToken);
	Task<PollEntryResult<PollEntryResponse>> RequalifyAsync(ClaimsPrincipal user, Guid pollId, Guid entryId, CancellationToken cancellationToken);
	Task<PollEntryResult<object?>> DeleteAsync(ClaimsPrincipal user, Guid pollId, Guid entryId, CancellationToken cancellationToken);
}

public sealed class PollEntryService : IPollEntryService
{
	private readonly ApplicationDbContext _db;
	private readonly ILogger<PollEntryService> _logger;
	private readonly IAssetStorage _assetStorage;

	private const int PublicImageSize = 512;
	private const int TeaserImageSize = 512;

	public PollEntryService(ApplicationDbContext db, ILogger<PollEntryService> logger, IAssetStorage assetStorage)
	{
		_db = db;
		_logger = logger;
		_assetStorage = assetStorage;
	}

	public async Task<PollEntryResult<IReadOnlyList<PollEntryResponse>>> GetAsync(ClaimsPrincipal user, Guid pollId, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollEntryResult<IReadOnlyList<PollEntryResponse>>.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollEntryResult<IReadOnlyList<PollEntryResponse>>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollEntryResult<IReadOnlyList<PollEntryResponse>>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var dbEntries = await _db.PollEntries
			.Where(e => e.PollId == pollId)
			.OrderBy(e => e.CreatedAt)
			.Include(e => e.SubmittedByMember)
			.Include(e => e.DisqualifiedByMember)
			.ToListAsync(cancellationToken);

		var entries = dbEntries.Select(e => new PollEntryResponse
		{
			Id = e.Id,
			DisplayName = e.DisplayName,
			Description = e.Description,
			OriginalAssetId = CanExposeFullAssets(poll, authUser, e.SubmittedByMemberId) ? e.OriginalAssetId : null,
			TeaserAssetId = e.TeaserAssetId,
			PublicAssetId = CanExposeFullAssets(poll, authUser, e.SubmittedByMemberId) ? e.PublicAssetId : null,
			IsDisqualified = e.IsDisqualified,
			DisqualificationReason = e.DisqualificationReason,
			DisqualifiedByDisplayName = authUser.IsAdmin ? e.DisqualifiedByMember?.DisplayName : null,
			DisqualifiedAt = authUser.IsAdmin ? e.DisqualifiedAt : null,
			CreatedAt = e.CreatedAt,
			SubmittedByDisplayName = authUser.IsAdmin || poll.Status == PollStatus.Closed || e.SubmittedByMemberId == member.Id
				? e.SubmittedByMember?.DisplayName ?? string.Empty
				: string.Empty,
			IsOwn = e.SubmittedByMemberId == member.Id
		}).ToList();

		if (entries.Count == 0)
		{
			return PollEntryResult<IReadOnlyList<PollEntryResponse>>.Ok(Array.Empty<PollEntryResponse>());
		}

		var orderedEntries = ShouldShuffleEntries(poll)
			? ShuffleDeterministic(entries, member.Id, poll.Id)
			: entries;

		return PollEntryResult<IReadOnlyList<PollEntryResponse>>.Ok(orderedEntries);
	}

	public async Task<PollEntryResult<object?>> DeleteAsync(ClaimsPrincipal user, Guid pollId, Guid entryId, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollEntryResult<object?>.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollEntryResult<object?>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollEntryResult<object?>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var now = DateTimeOffset.UtcNow;
		var submissionWindowOpen = poll.Status == PollStatus.SubmissionOpen && now >= poll.SubmissionOpensAt && now <= poll.SubmissionClosesAt;

		var entry = await _db.PollEntries.FirstOrDefaultAsync(e => e.Id == entryId && e.PollId == pollId, cancellationToken);
		if (entry is null)
		{
			return PollEntryResult<object?>.NotFound();
		}

		var isOwner = entry.SubmittedByMemberId == member.Id;
		if (!authUser.IsAdmin)
		{
			if (!submissionWindowOpen)
			{
				return PollEntryResult<object?>.Forbidden("Submissions are not open");
			}

			if (!isOwner)
			{
				return PollEntryResult<object?>.Forbidden("Not allowed to delete this entry");
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

		return PollEntryResult<object?>.NoContent();
	}

	public async Task<PollEntryResult<PollEntryResponse>> DisqualifyAsync(ClaimsPrincipal user, Guid pollId, Guid entryId, DisqualifyEntryRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollEntryResult<PollEntryResponse>.Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return PollEntryResult<PollEntryResponse>.Forbidden("Admin only");
		}

		var trimmedReason = request.Reason?.Trim();
		if (string.IsNullOrWhiteSpace(trimmedReason))
		{
			return PollEntryResult<PollEntryResponse>.BadRequest("Disqualification reason is required");
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollEntryResult<PollEntryResponse>.Unauthorized();
		}

		var entry = await _db.PollEntries
			.Include(e => e.Poll)
			.FirstOrDefaultAsync(e => e.Id == entryId && e.PollId == pollId && e.Poll.CommunityId == member.CommunityId, cancellationToken);

		if (entry is null)
		{
			return PollEntryResult<PollEntryResponse>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, entry.Poll, _logger, cancellationToken);

		entry.IsDisqualified = true;
		entry.DisqualificationReason = trimmedReason;
		entry.DisqualifiedByMemberId = member.Id;
		entry.DisqualifiedAt = DateTimeOffset.UtcNow;
		entry.DisqualifiedByMember = member;
		await _db.SaveChangesAsync(cancellationToken);

		return PollEntryResult<PollEntryResponse>.Ok(ToResponse(entry));
	}

	public async Task<PollEntryResult<PollEntryResponse>> RequalifyAsync(ClaimsPrincipal user, Guid pollId, Guid entryId, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollEntryResult<PollEntryResponse>.Unauthorized();
		}

		if (!authUser.IsAdmin)
		{
			return PollEntryResult<PollEntryResponse>.Forbidden("Admin only");
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollEntryResult<PollEntryResponse>.Unauthorized();
		}

		var entry = await _db.PollEntries
			.Include(e => e.Poll)
			.FirstOrDefaultAsync(e => e.Id == entryId && e.PollId == pollId && e.Poll.CommunityId == member.CommunityId, cancellationToken);

		if (entry is null)
		{
			return PollEntryResult<PollEntryResponse>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, entry.Poll, _logger, cancellationToken);

		entry.IsDisqualified = false;
		entry.DisqualificationReason = null;
		entry.DisqualifiedByMemberId = null;
		entry.DisqualifiedByMember = null;
		entry.DisqualifiedAt = null;
		await _db.SaveChangesAsync(cancellationToken);

		return PollEntryResult<PollEntryResponse>.Ok(ToResponse(entry));
	}

	public async Task<PollEntryResult<PollEntryResponse>> SubmitAsync(ClaimsPrincipal user, Guid pollId, SubmitEntryRequest request, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(user);
		if (authUser is null)
		{
			return PollEntryResult<PollEntryResponse>.Unauthorized();
		}

		var member = await _db.CommunityMembers.FirstOrDefaultAsync(m => m.Id == authUser.MemberId, cancellationToken);
		if (member is null)
		{
			return PollEntryResult<PollEntryResponse>.Unauthorized();
		}

		var poll = await _db.Polls.FirstOrDefaultAsync(p => p.Id == pollId && p.CommunityId == member.CommunityId, cancellationToken);
		if (poll is null)
		{
			return PollEntryResult<PollEntryResponse>.NotFound();
		}

		await PollAutoTransition.ApplyAsync(_db, poll, _logger, cancellationToken);

		var submitCheck = CanSubmit(poll, member);
		if (!submitCheck.Allowed)
		{
			return PollEntryResult<PollEntryResponse>.Forbidden(submitCheck.Reason ?? "Submissions are not open");
		}

		var titleRequirement = poll.TitleRequirement;
		var descriptionRequirement = poll.DescriptionRequirement;
		var imageRequirement = poll.ImageRequirement;

		if (titleRequirement == FieldRequirement.Required && string.IsNullOrWhiteSpace(request.DisplayName))
		{
			return PollEntryResult<PollEntryResponse>.BadRequest("Display name is required");
		}

		if (descriptionRequirement == FieldRequirement.Required && string.IsNullOrWhiteSpace(request.Description))
		{
			return PollEntryResult<PollEntryResponse>.BadRequest("Description is required");
		}

		var hasImage = request.OriginalAssetId.HasValue && request.OriginalAssetId.Value != Guid.Empty;

		if (imageRequirement == FieldRequirement.Off && hasImage)
		{
			return PollEntryResult<PollEntryResponse>.BadRequest("Images are disabled for this poll");
		}

		if (imageRequirement == FieldRequirement.Required && !hasImage)
		{
			return PollEntryResult<PollEntryResponse>.BadRequest("An image is required for this poll");
		}

		var now = DateTimeOffset.UtcNow;
		if (poll.Status != PollStatus.SubmissionOpen || now < poll.SubmissionOpensAt || now > poll.SubmissionClosesAt)
		{
			return PollEntryResult<PollEntryResponse>.Forbidden("Submissions are not open");
		}

		var submissions = await _db.PollEntries.CountAsync(e => e.PollId == pollId && e.SubmittedByMemberId == member.Id, cancellationToken);
		if (submissions >= poll.MaxSubmissionsPerMember)
		{
			return PollEntryResult<PollEntryResponse>.BadRequest("Submission limit reached for this poll");
		}

		Asset? originalAsset = null;
		Asset? publicAsset = null;
		Asset? teaserAsset = null;

		if (hasImage)
		{
			originalAsset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == request.OriginalAssetId, cancellationToken);
			if (originalAsset is null)
			{
				return PollEntryResult<PollEntryResponse>.BadRequest("Original asset not found");
			}

			if (!originalAsset.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
			{
				return PollEntryResult<PollEntryResponse>.BadRequest("Original asset must be an image");
			}

			try
			{
				(publicAsset, teaserAsset) = await CreateDerivedAssetsAsync(originalAsset, cancellationToken);
			}
			catch (InvalidOperationException ex)
			{
				return PollEntryResult<PollEntryResponse>.BadRequest(ex.Message);
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Failed to create derived assets for entry in poll {PollId}", poll.Id);
				return PollEntryResult<PollEntryResponse>.BadRequest("Unable to process image. Please try again");
			}

			ArgumentNullException.ThrowIfNull(publicAsset);
			ArgumentNullException.ThrowIfNull(teaserAsset);
		}

		var resolvedDisplayName = request.DisplayName?.Trim() ?? string.Empty;
		if (titleRequirement == FieldRequirement.Off || string.IsNullOrWhiteSpace(resolvedDisplayName))
		{
			resolvedDisplayName = string.Empty;
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
			IsDisqualified = false,
			DisqualifiedByMemberId = null,
			DisqualifiedAt = null
		};

		if (hasImage)
		{
			_db.Assets.AddRange(publicAsset!, teaserAsset!);
		}
		_db.PollEntries.Add(entry);
		await _db.SaveChangesAsync(cancellationToken);

		return PollEntryResult<PollEntryResponse>.Ok(ToResponse(entry));
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

	private static bool CanExposeFullAssets(Poll poll, AuthenticatedUser authUser, Guid submittedByMemberId)
	{
		return authUser.IsAdmin || submittedByMemberId == authUser.MemberId || poll.Status == PollStatus.VotingOpen || poll.Status == PollStatus.Closed;
	}

	private static bool ShouldShuffleEntries(Poll poll)
	{
		var now = DateTimeOffset.UtcNow;
		var submissionWindowOpen = poll.Status == PollStatus.SubmissionOpen && now >= poll.SubmissionOpensAt && now <= poll.SubmissionClosesAt;
		var votingWindowOpen = poll.Status == PollStatus.VotingOpen && now >= poll.VotingOpensAt && now <= poll.VotingClosesAt;
		var reviewWindow = poll.Status == PollStatus.Review;
		return submissionWindowOpen || votingWindowOpen || reviewWindow;
	}

	private static List<PollEntryResponse> ShuffleDeterministic(IReadOnlyList<PollEntryResponse> items, Guid memberId, Guid pollId)
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

	private static PollEntryResponse ToResponse(PollEntry entry)
	{
		return new PollEntryResponse
		{
			Id = entry.Id,
			DisplayName = entry.DisplayName,
			Description = entry.Description,
			OriginalAssetId = entry.OriginalAssetId,
			TeaserAssetId = entry.TeaserAssetId,
			PublicAssetId = entry.PublicAssetId,
			IsDisqualified = entry.IsDisqualified,
			DisqualificationReason = entry.DisqualificationReason,
			DisqualifiedByDisplayName = entry.DisqualifiedByMember?.DisplayName,
			DisqualifiedAt = entry.DisqualifiedAt,
			CreatedAt = entry.CreatedAt,
			SubmittedByDisplayName = entry.SubmittedByMember?.DisplayName ?? string.Empty,
			IsOwn = false
		};
	}

	private readonly record struct EligibilityResult(bool Allowed, string? Reason)
	{
		public static EligibilityResult Allow() => new(true, null);
		public static EligibilityResult Deny(string reason) => new(false, reason);
	}
}

public sealed record PollEntryResult<T>(PollEntryOutcome Outcome, T? Response, string? Message)
{
	public static PollEntryResult<T> Ok(T response) => new(PollEntryOutcome.Ok, response, null);
	public static PollEntryResult<T> NoContent() => new(PollEntryOutcome.NoContent, default, null);
	public static PollEntryResult<T> NotFound() => new(PollEntryOutcome.NotFound, default, null);
	public static PollEntryResult<T> Unauthorized() => new(PollEntryOutcome.Unauthorized, default, null);
	public static PollEntryResult<T> Forbidden(string message) => new(PollEntryOutcome.Forbidden, default, message);
	public static PollEntryResult<T> BadRequest(string message) => new(PollEntryOutcome.BadRequest, default, message);
}

public enum PollEntryOutcome
{
	Ok,
	NoContent,
	NotFound,
	Unauthorized,
	Forbidden,
	BadRequest
}
