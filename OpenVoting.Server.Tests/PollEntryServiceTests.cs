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
}
