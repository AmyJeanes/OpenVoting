using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using NUnit.Framework;

namespace OpenVoting.Server.Tests;

public class PollServiceTests
{
	[Test]
	public async Task UpdateMetadata_WhenVotingLocked_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var communityId = Guid.NewGuid();
		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });
		var member = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
		};

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			LockedAt = DateTimeOffset.UtcNow,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(1)
		};

		db.CommunityMembers.Add(member);
		db.Polls.Add(poll);
		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.UpdateMetadataAsync(
			TestAuthHelper.CreatePrincipal(member.Id, communityId, isAdmin: true),
			poll.Id,
			new UpdatePollMetadataRequest { VotingMethod = VotingMethod.IRV },
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.BadRequest));
		Assert.That(result.Message, Does.Contain("Voting method is locked"));
	}

	[Test]
	public async Task OpenVoting_WithWrongStatus_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.Draft,
			SubmissionOpensAt = DateTimeOffset.UtcNow,
			SubmissionClosesAt = DateTimeOffset.MaxValue,
			VotingOpensAt = DateTimeOffset.MaxValue,
			VotingClosesAt = DateTimeOffset.MaxValue
		});

		await db.SaveChangesAsync();

		var poll = await db.Polls.FirstAsync();
		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.OpenVotingAsync(TestAuthHelper.CreatePrincipal(memberId, communityId, isAdmin: true), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.BadRequest));
		Assert.That(result.Message, Does.Contain(PollStatus.Review.ToString()));
	}

	[Test]
	public async Task Delete_RemovesPollRelatedEntitiesAndBlobs()
	{
		await using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var communityId = Guid.NewGuid();
		var adminId = Guid.NewGuid();
		var fakeStorage = new FakeAssetStorage();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });

		var member = new CommunityMember
		{
			Id = adminId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow
		};

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Title = "Test",
			SubmissionOpensAt = DateTimeOffset.UtcNow,
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddDays(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(2)
		};

		var asset1 = fakeStorage.SaveAssetFromBytes(new byte[] { 1, 2, 3 }, storageKey: "assets/a.png");
		var asset2 = fakeStorage.SaveAssetFromBytes(new byte[] { 4, 5, 6 }, storageKey: "assets/b.png");

		db.CommunityMembers.Add(member);
		db.Assets.AddRange(asset1, asset2);

		var entry = new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = adminId,
			DisplayName = "Entry",
			OriginalAssetId = asset1.Id,
			TeaserAssetId = asset2.Id,
			PublicAssetId = null,
			CreatedAt = DateTimeOffset.UtcNow
		};

		var vote = new Vote
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			MemberId = adminId,
			CreatedAt = DateTimeOffset.UtcNow,
			IsFinal = true,
			SubmittedAt = DateTimeOffset.UtcNow
		};

		db.Polls.Add(poll);
		db.PollEntries.Add(entry);
		db.Votes.Add(vote);
		db.VoteChoices.Add(new VoteChoice { Id = Guid.NewGuid(), EntryId = entry.Id, VoteId = vote.Id });

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, fakeStorage);
		var result = await service.DeleteAsync(TestAuthHelper.CreatePrincipal(adminId, communityId, isAdmin: true), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.NoContent));
		Assert.That(await db.Polls.CountAsync(), Is.EqualTo(0));
		Assert.That(await db.PollEntries.CountAsync(), Is.EqualTo(0));
		Assert.That(await db.Votes.CountAsync(), Is.EqualTo(0));
		Assert.That(await db.Assets.CountAsync(), Is.EqualTo(0));
		Assert.That(fakeStorage.DeletedKeys, Is.EquivalentTo(new[] { "assets/a.png", "assets/b.png" }));
	}

	[Test]
	public async Task GetPoll_ReturnsApprovalWinnersWithTie()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });

		var admin = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "admin",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow
		};

		var pollId = Guid.NewGuid();
		var entryA = Guid.NewGuid();
		var entryB = Guid.NewGuid();

		db.CommunityMembers.Add(admin);
		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.Closed,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-5),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-4),
			VotingOpensAt = DateTimeOffset.UtcNow.AddDays(-3),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(-2)
		});

		db.PollEntries.AddRange(
			new PollEntry { Id = entryA, PollId = pollId, SubmittedByMemberId = admin.Id, DisplayName = "A" },
			new PollEntry { Id = entryB, PollId = pollId, SubmittedByMemberId = admin.Id, DisplayName = "B" });

		var vote1 = new Vote { Id = Guid.NewGuid(), PollId = pollId, MemberId = admin.Id, IsFinal = true, SubmittedAt = DateTimeOffset.UtcNow };
		var vote2 = new Vote { Id = Guid.NewGuid(), PollId = pollId, MemberId = Guid.NewGuid(), IsFinal = true, SubmittedAt = DateTimeOffset.UtcNow };

		db.Votes.AddRange(vote1, vote2);
		db.VoteChoices.AddRange(
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote1.Id, EntryId = entryA },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote1.Id, EntryId = entryB },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote2.Id, EntryId = entryA },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote2.Id, EntryId = entryB }
		);

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(admin.Id, communityId, isAdmin: true), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var winners = result.Response!.Winners;
		Assert.That(winners.Count, Is.EqualTo(2));
		Assert.That(winners.Select(w => w.EntryId), Is.EquivalentTo(new[] { entryA, entryB }));
	}

	[Test]
	public async Task GetPoll_ReturnsIrvWinner()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });

		var admin = new CommunityMember
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "admin",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow
		};

		var pollId = Guid.NewGuid();
		var entryA = Guid.NewGuid();
		var entryB = Guid.NewGuid();
		var entryC = Guid.NewGuid();

		db.CommunityMembers.Add(admin);
		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.Closed,
			VotingMethod = VotingMethod.IRV,
			RequireRanking = true,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-5),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-4),
			VotingOpensAt = DateTimeOffset.UtcNow.AddDays(-3),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(-2)
		});

		db.PollEntries.AddRange(
			new PollEntry { Id = entryA, PollId = pollId, SubmittedByMemberId = admin.Id, DisplayName = "A" },
			new PollEntry { Id = entryB, PollId = pollId, SubmittedByMemberId = admin.Id, DisplayName = "B" },
			new PollEntry { Id = entryC, PollId = pollId, SubmittedByMemberId = admin.Id, DisplayName = "C" });

		var vote1 = new Vote { Id = Guid.NewGuid(), PollId = pollId, MemberId = admin.Id, IsFinal = true, SubmittedAt = DateTimeOffset.UtcNow };
		var vote2 = new Vote { Id = Guid.NewGuid(), PollId = pollId, MemberId = Guid.NewGuid(), IsFinal = true, SubmittedAt = DateTimeOffset.UtcNow };
		var vote3 = new Vote { Id = Guid.NewGuid(), PollId = pollId, MemberId = Guid.NewGuid(), IsFinal = true, SubmittedAt = DateTimeOffset.UtcNow };

		db.Votes.AddRange(vote1, vote2, vote3);
		db.VoteChoices.AddRange(
			// Ballot 1: A > B > C
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote1.Id, EntryId = entryA, Rank = 1 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote1.Id, EntryId = entryB, Rank = 2 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote1.Id, EntryId = entryC, Rank = 3 },
			// Ballot 2: B > C > A
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote2.Id, EntryId = entryB, Rank = 1 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote2.Id, EntryId = entryC, Rank = 2 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote2.Id, EntryId = entryA, Rank = 3 },
			// Ballot 3: A > C > B
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote3.Id, EntryId = entryA, Rank = 1 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote3.Id, EntryId = entryC, Rank = 2 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote3.Id, EntryId = entryB, Rank = 3 }
		);

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(admin.Id, communityId, isAdmin: true), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var winners = result.Response!.Winners;
		Assert.That(winners.Count, Is.EqualTo(1));
		Assert.That(winners.Single().EntryId, Is.EqualTo(entryA));
	}
}
