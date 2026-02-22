using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using NUnit.Framework;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;

namespace OpenVoting.Server.Tests;

public class PollEntryServiceTests
{
	[Test]
	public async Task Disqualify_WhenReasonMissing_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var adminId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();
		var pollId = Guid.NewGuid();
		var entryId = Guid.NewGuid();

		db.CommunityMembers.AddRange(
			new CommunityMember
			{
				Id = adminId,
				CommunityId = communityId,
				Platform = Platform.Discord,
				ExternalUserId = "admin",
				DisplayName = "Admin",
				JoinedAt = DateTimeOffset.UtcNow.AddMonths(-2)
			},
			new CommunityMember
			{
				Id = submitterId,
				CommunityId = communityId,
				Platform = Platform.Discord,
				ExternalUserId = "user",
				DisplayName = "Submitter",
				JoinedAt = DateTimeOffset.UtcNow.AddMonths(-2)
			});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(2)
		});

		db.PollEntries.Add(new PollEntry
		{
			Id = entryId,
			PollId = pollId,
			SubmittedByMemberId = submitterId,
			DisplayName = "Entry",
			CreatedAt = DateTimeOffset.UtcNow
		});

		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.DisqualifyAsync(
			TestAuthHelper.CreatePrincipal(adminId, communityId, isAdmin: true),
			pollId,
			entryId,
			new DisqualifyEntryRequest { Reason = "   " },
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.BadRequest));
		Assert.That(result.Message, Is.EqualTo("Disqualification reason is required"));
	}

	[Test]
	public async Task Disqualify_WithReason_SetsMetadata_AndRequalify_ClearsIt()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var adminId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();
		var pollId = Guid.NewGuid();
		var entryId = Guid.NewGuid();

		db.CommunityMembers.AddRange(
			new CommunityMember
			{
				Id = adminId,
				CommunityId = communityId,
				Platform = Platform.Discord,
				ExternalUserId = "admin",
				DisplayName = "Admin",
				JoinedAt = DateTimeOffset.UtcNow.AddMonths(-2)
			},
			new CommunityMember
			{
				Id = submitterId,
				CommunityId = communityId,
				Platform = Platform.Discord,
				ExternalUserId = "user",
				DisplayName = "Submitter",
				JoinedAt = DateTimeOffset.UtcNow.AddMonths(-2)
			});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(2)
		});

		db.PollEntries.Add(new PollEntry
		{
			Id = entryId,
			PollId = pollId,
			SubmittedByMemberId = submitterId,
			DisplayName = "Entry",
			CreatedAt = DateTimeOffset.UtcNow
		});

		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var disqualifyResult = await service.DisqualifyAsync(
			TestAuthHelper.CreatePrincipal(adminId, communityId, isAdmin: true),
			pollId,
			entryId,
			new DisqualifyEntryRequest { Reason = "Duplicate submission" },
			CancellationToken.None);

		Assert.That(disqualifyResult.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		Assert.That(disqualifyResult.Response, Is.Not.Null);
		Assert.That(disqualifyResult.Response!.DisqualificationReason, Is.EqualTo("Duplicate submission"));
		Assert.That(disqualifyResult.Response!.DisqualifiedAt, Is.Not.Null);

		var entry = await db.PollEntries.FirstAsync(e => e.Id == entryId);
		Assert.Multiple(() =>
		{
			Assert.That(entry.IsDisqualified, Is.True);
			Assert.That(entry.DisqualificationReason, Is.EqualTo("Duplicate submission"));
			Assert.That(entry.DisqualifiedByMemberId, Is.EqualTo(adminId));
			Assert.That(entry.DisqualifiedAt, Is.Not.Null);
		});

		var requalifyResult = await service.RequalifyAsync(
			TestAuthHelper.CreatePrincipal(adminId, communityId, isAdmin: true),
			pollId,
			entryId,
			CancellationToken.None);

		Assert.That(requalifyResult.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		entry = await db.PollEntries.FirstAsync(e => e.Id == entryId);
		Assert.Multiple(() =>
		{
			Assert.That(entry.IsDisqualified, Is.False);
			Assert.That(entry.DisqualificationReason, Is.Null);
			Assert.That(entry.DisqualifiedByMemberId, Is.Null);
			Assert.That(entry.DisqualifiedAt, Is.Null);
		});
	}

	[Test]
	public async Task Submit_WhenImageRequiredAndMissing_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var member = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
		};

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.SubmissionOpen,
			TitleRequirement = FieldRequirement.Optional,
			DescriptionRequirement = FieldRequirement.Optional,
			ImageRequirement = FieldRequirement.Required,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddHours(1)
		};

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(member.Id, communityId),
			poll.Id,
			new SubmitEntryRequest { DisplayName = "Entry" },
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.BadRequest));
		Assert.That(result.Message, Is.EqualTo("An image is required for this poll"));
	}

	[Test]
	public async Task Submit_WithValidImage_CreatesDerivedAssetsAndEntry()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var member = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
		};

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.SubmissionOpen,
			TitleRequirement = FieldRequirement.Required,
			DescriptionRequirement = FieldRequirement.Optional,
			ImageRequirement = FieldRequirement.Required,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddMinutes(-5),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddMinutes(5)
		};

		var storage = new FakeAssetStorage();
		var imageBytes = CreateValidSquarePngBytes();
		var originalAsset = storage.SaveAssetFromBytes(imageBytes, contentType: "image/png", storageKey: "assets/original.png");

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		db.Assets.Add(originalAsset);
		await db.SaveChangesAsync();

		storage.RegisterAsset(originalAsset, imageBytes);

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, storage);
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(member.Id, communityId),
			poll.Id,
			new SubmitEntryRequest { DisplayName = "Entry", OriginalAssetId = originalAsset.Id },
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		Assert.That(await db.PollEntries.CountAsync(), Is.EqualTo(1));
		Assert.That(await db.Assets.CountAsync(), Is.EqualTo(2));

		var entry = await db.PollEntries.FirstAsync();
		Assert.That(entry.TeaserBlurHash, Is.Not.Null.And.Not.Empty);
		Assert.That(entry.PublicAssetId, Is.Not.Null);
	}

	private static byte[] CreateValidSquarePngBytes()
	{
		using var image = new Image<Rgba32>(8, 8);
		for (var y = 0; y < image.Height; y++)
		{
			for (var x = 0; x < image.Width; x++)
			{
				image[x, y] = new Rgba32((byte)(x * 24), (byte)(y * 24), 140, 255);
			}
		}

		using var ms = new MemoryStream();
		image.Save(ms, new PngEncoder());
		return ms.ToArray();
	}

	[Test]
	public async Task Delete_OwnerDuringSubmission_RemovesAssetsAndVotes()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var storage = new FakeAssetStorage();

		var member = new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
		};

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.SubmissionOpen,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddMinutes(-5),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddMinutes(5)
		};

		var originalAsset = storage.SaveAssetFromBytes(new byte[] { 1, 2 }, storageKey: "assets/original.png");
		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		db.Assets.Add(originalAsset);

		var entryId = Guid.NewGuid();
		var entry = new PollEntry
		{
			Id = entryId,
			PollId = poll.Id,
			SubmittedByMemberId = memberId,
			DisplayName = "Entry",
			OriginalAssetId = originalAsset.Id,
			PublicAssetId = null,
			CreatedAt = DateTimeOffset.UtcNow
		};

		db.PollEntries.Add(entry);
		db.VoteChoices.Add(new VoteChoice { Id = Guid.NewGuid(), EntryId = entryId, VoteId = Guid.NewGuid() });
		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, storage);
		var result = await service.DeleteAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), poll.Id, entryId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.NoContent));
		Assert.That(await db.PollEntries.CountAsync(), Is.EqualTo(0));
		Assert.That(await db.VoteChoices.CountAsync(), Is.EqualTo(0));
		Assert.That(storage.DeletedKeys, Is.EquivalentTo(new[] { "assets/original.png" }));
	}

	[Test]
	public async Task Get_WhenVotingOpen_ShufflesEntriesPerMember()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		var entryIds = new[]
		{
			Guid.Parse("00000000-0000-0000-0000-000000000001"),
			Guid.Parse("00000000-0000-0000-0000-000000000002"),
			Guid.Parse("00000000-0000-0000-0000-000000000003")
		};

		var createdOrder = entryIds.ToList();
		var pollId = Guid.NewGuid();
		var expectedOrder = ShuffleDeterministic(createdOrder, memberId, pollId);
		while (expectedOrder.SequenceEqual(createdOrder))
		{
			pollId = Guid.NewGuid();
			expectedOrder = ShuffleDeterministic(createdOrder, memberId, pollId);
		}

		var member = new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = now.AddMonths(-1)
		};

		var poll = new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			SubmissionOpensAt = now.AddDays(-1),
			SubmissionClosesAt = now.AddHours(-1),
			VotingOpensAt = now.AddMinutes(-5),
			VotingClosesAt = now.AddHours(1)
		};

		var entries = new[]
		{
			new PollEntry { Id = entryIds[0], PollId = poll.Id, SubmittedByMemberId = memberId, DisplayName = "First", CreatedAt = now.AddMinutes(-3) },
			new PollEntry { Id = entryIds[1], PollId = poll.Id, SubmittedByMemberId = memberId, DisplayName = "Second", CreatedAt = now.AddMinutes(-2) },
			new PollEntry { Id = entryIds[2], PollId = poll.Id, SubmittedByMemberId = memberId, DisplayName = "Third", CreatedAt = now.AddMinutes(-1) }
		};

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		db.PollEntries.AddRange(entries);
		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));

		var orderedIds = result.Response!.Select(e => e.Id).ToList();
		Assert.That(expectedOrder, Is.Not.EqualTo(createdOrder));
		Assert.That(orderedIds, Is.EqualTo(expectedOrder));
	}

	[Test]
	public async Task Get_WhenReview_HidesOriginalAndPublicForNonAdmins()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = now.AddMonths(-1)
		});

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = submitterId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "submitter",
			DisplayName = "Submitter",
			JoinedAt = now.AddMonths(-2)
		});

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = now.AddDays(-2),
			SubmissionClosesAt = now.AddDays(-1),
			VotingOpensAt = now.AddHours(1),
			VotingClosesAt = now.AddHours(2)
		};

		var originalAssetId = Guid.NewGuid();
		var publicAssetId = Guid.NewGuid();
		var teaserBlurHash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

		db.Polls.Add(poll);
		db.PollEntries.Add(new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = submitterId,
			DisplayName = "Entry",
			OriginalAssetId = originalAssetId,
			PublicAssetId = publicAssetId,
			TeaserBlurHash = teaserBlurHash,
			CreatedAt = now.AddMinutes(-5)
		});

		await db.SaveChangesAsync();
		Assert.That(await db.PollEntries.CountAsync(), Is.EqualTo(1));

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		Assert.That(result.Response, Is.Not.Null);
		Assert.That(result.Response!.Count, Is.EqualTo(1));
		var entry = result.Response!.Single();
		Assert.Multiple(() =>
		{
			Assert.That(entry.OriginalAssetId, Is.Null);
			Assert.That(entry.PublicAssetId, Is.Null);
			Assert.That(entry.TeaserBlurHash, Is.EqualTo(teaserBlurHash));
		});
	}

	[Test]
	public async Task Get_WhenReview_ShowsOriginalAndPublicForOwner()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = now.AddMonths(-1)
		});

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = now.AddDays(-2),
			SubmissionClosesAt = now.AddDays(-1),
			VotingOpensAt = now.AddHours(1),
			VotingClosesAt = now.AddHours(2)
		};

		var originalAssetId = Guid.NewGuid();
		var publicAssetId = Guid.NewGuid();
		var teaserBlurHash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

		db.Polls.Add(poll);
		db.PollEntries.Add(new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = memberId,
			DisplayName = "Entry",
			OriginalAssetId = originalAssetId,
			PublicAssetId = publicAssetId,
			TeaserBlurHash = teaserBlurHash,
			CreatedAt = now.AddMinutes(-5)
		});

		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		var entry = result.Response!.Single();
		Assert.Multiple(() =>
		{
			Assert.That(entry.OriginalAssetId, Is.EqualTo(originalAssetId));
			Assert.That(entry.PublicAssetId, Is.EqualTo(publicAssetId));
			Assert.That(entry.TeaserBlurHash, Is.EqualTo(teaserBlurHash));
		});
	}

	[Test]
	public async Task Get_WhenVotingOpen_AdminsSeeShuffledOrder()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var adminId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		var entryIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

		var createdOrder = entryIds.ToList();
		var pollId = Guid.NewGuid();
		var expectedOrder = ShuffleDeterministic(createdOrder, adminId, pollId);
		while (expectedOrder.SequenceEqual(createdOrder))
		{
			pollId = Guid.NewGuid();
			expectedOrder = ShuffleDeterministic(createdOrder, adminId, pollId);
		}

		var admin = new CommunityMember
		{
			Id = adminId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "admin",
			DisplayName = "Admin",
			JoinedAt = now.AddMonths(-1)
		};

		var submitter = new CommunityMember
		{
			Id = submitterId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = now.AddMonths(-2)
		};

		var poll = new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			SubmissionOpensAt = now.AddDays(-1),
			SubmissionClosesAt = now.AddHours(-1),
			VotingOpensAt = now.AddMinutes(-5),
			VotingClosesAt = now.AddHours(1)
		};

		var entries = new[]
		{
			new PollEntry { Id = entryIds[0], PollId = poll.Id, SubmittedByMemberId = submitterId, DisplayName = "First", CreatedAt = now.AddMinutes(-3) },
			new PollEntry { Id = entryIds[1], PollId = poll.Id, SubmittedByMemberId = submitterId, DisplayName = "Second", CreatedAt = now.AddMinutes(-2) },
			new PollEntry { Id = entryIds[2], PollId = poll.Id, SubmittedByMemberId = submitterId, DisplayName = "Third", CreatedAt = now.AddMinutes(-1) }
		};

		db.CommunityMembers.AddRange(admin, submitter);
		db.Polls.Add(poll);
		db.PollEntries.AddRange(entries);
		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(adminId, communityId, isAdmin: true), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));

		var orderedIds = result.Response!.Select(e => e.Id).ToList();
		Assert.That(expectedOrder, Is.Not.EqualTo(createdOrder));
		Assert.That(orderedIds, Is.EqualTo(expectedOrder));
	}

	[Test]
	public async Task Get_WhenSubmissionOpen_ShufflesEntriesPerMember()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;
		var entryIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

		var createdOrder = entryIds.ToList();
		var pollId = Guid.NewGuid();
		var expectedOrder = ShuffleDeterministic(createdOrder, memberId, pollId);
		while (expectedOrder.SequenceEqual(createdOrder))
		{
			pollId = Guid.NewGuid();
			expectedOrder = ShuffleDeterministic(createdOrder, memberId, pollId);
		}

		var member = new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = now.AddMonths(-1)
		};

		var poll = new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.SubmissionOpen,
			SubmissionOpensAt = now.AddMinutes(-5),
			SubmissionClosesAt = now.AddMinutes(5),
			VotingOpensAt = now.AddHours(1),
			VotingClosesAt = now.AddHours(2)
		};

		var entries = new[]
		{
			new PollEntry { Id = entryIds[0], PollId = poll.Id, SubmittedByMemberId = memberId, DisplayName = "First", CreatedAt = now.AddMinutes(-3) },
			new PollEntry { Id = entryIds[1], PollId = poll.Id, SubmittedByMemberId = memberId, DisplayName = "Second", CreatedAt = now.AddMinutes(-2) },
			new PollEntry { Id = entryIds[2], PollId = poll.Id, SubmittedByMemberId = memberId, DisplayName = "Third", CreatedAt = now.AddMinutes(-1) }
		};

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		db.PollEntries.AddRange(entries);
		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));

		Assert.That(expectedOrder, Is.Not.EqualTo(createdOrder));
		Assert.That(result.Response!.Select(e => e.Id).ToList(), Is.EqualTo(expectedOrder));
	}
	private static List<Guid> ShuffleDeterministic(IReadOnlyList<Guid> items, Guid memberId, Guid pollId)
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
}
