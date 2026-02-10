using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using NUnit.Framework;

namespace OpenVoting.Server.Tests;

public class PollEntryServiceTests
{
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
		var originalAsset = storage.SaveAssetFromBytes(new byte[] { 1, 2, 3, 4 }, contentType: "image/png", storageKey: "assets/original.png");

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		db.Assets.Add(originalAsset);
		await db.SaveChangesAsync();

		storage.RegisterAsset(originalAsset, new byte[] { 1, 2, 3, 4 });

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, storage);
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(member.Id, communityId),
			poll.Id,
			new SubmitEntryRequest { DisplayName = "Entry", OriginalAssetId = originalAsset.Id },
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		Assert.That(await db.PollEntries.CountAsync(), Is.EqualTo(1));
		Assert.That(await db.Assets.CountAsync(), Is.EqualTo(3));

		var entry = await db.PollEntries.FirstAsync();
		Assert.That(entry.TeaserAssetId, Is.Not.Null);
		Assert.That(entry.PublicAssetId, Is.Not.Null);
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
		var teaserAsset = storage.SaveAssetFromBytes(new byte[] { 3, 4 }, storageKey: "assets/teaser.png");

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		db.Assets.AddRange(originalAsset, teaserAsset);

		var entryId = Guid.NewGuid();
		var entry = new PollEntry
		{
			Id = entryId,
			PollId = poll.Id,
			SubmittedByMemberId = memberId,
			DisplayName = "Entry",
			OriginalAssetId = originalAsset.Id,
			TeaserAssetId = teaserAsset.Id,
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
		Assert.That(storage.DeletedKeys, Is.EquivalentTo(new[] { "assets/original.png", "assets/teaser.png" }));
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
		var teaserAssetId = Guid.NewGuid();

		db.Polls.Add(poll);
		db.PollEntries.Add(new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = memberId,
			DisplayName = "Entry",
			OriginalAssetId = originalAssetId,
			PublicAssetId = publicAssetId,
			TeaserAssetId = teaserAssetId,
			CreatedAt = now.AddMinutes(-5)
		});

		await db.SaveChangesAsync();

		var service = new PollEntryService(db, NullLogger<PollEntryService>.Instance, new FakeAssetStorage());
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollEntryOutcome.Ok));
		var entry = result.Response!.Single();
		Assert.Multiple(() =>
		{
			Assert.That(entry.OriginalAssetId, Is.Null);
			Assert.That(entry.PublicAssetId, Is.Null);
			Assert.That(entry.TeaserAssetId, Is.EqualTo(teaserAssetId));
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
