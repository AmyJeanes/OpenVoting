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
	public async Task UpdateMetadata_WithFieldRequirementChanges_PersistsAndReturns()
	{
		await using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });
		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
		});

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Title = "Test",
			Description = "Desc",
			TitleRequirement = FieldRequirement.Required,
			DescriptionRequirement = FieldRequirement.Optional,
			ImageRequirement = FieldRequirement.Required,
			SubmissionOpensAt = DateTimeOffset.UtcNow,
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddDays(2),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(3)
		};

		db.Polls.Add(poll);
		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.UpdateMetadataAsync(
			TestAuthHelper.CreatePrincipal(memberId, communityId, isAdmin: true),
			poll.Id,
			new UpdatePollMetadataRequest
			{
				TitleRequirement = FieldRequirement.Optional,
				DescriptionRequirement = FieldRequirement.Off,
				ImageRequirement = FieldRequirement.Optional
			},
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var response = result.Response!;
		Assert.Multiple(() =>
		{
			Assert.That(response.TitleRequirement, Is.EqualTo(FieldRequirement.Optional));
			Assert.That(response.DescriptionRequirement, Is.EqualTo(FieldRequirement.Off));
			Assert.That(response.ImageRequirement, Is.EqualTo(FieldRequirement.Optional));
		});

		var updated = await db.Polls.FirstAsync(p => p.Id == poll.Id);
		Assert.Multiple(() =>
		{
			Assert.That(updated.TitleRequirement, Is.EqualTo(FieldRequirement.Optional));
			Assert.That(updated.DescriptionRequirement, Is.EqualTo(FieldRequirement.Off));
			Assert.That(updated.ImageRequirement, Is.EqualTo(FieldRequirement.Optional));
		});
	}

	[Test]
	public async Task GetPoll_ReturnsFieldRequirements()
	{
		await using var db = TestDbContextFactory.CreateContext(useSqlite: true);
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });
		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Admin",
			JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
		});

		db.Polls.Add(new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Title = "Test",
			TitleRequirement = FieldRequirement.Optional,
			DescriptionRequirement = FieldRequirement.Required,
			ImageRequirement = FieldRequirement.Off,
			SubmissionOpensAt = DateTimeOffset.UtcNow,
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddDays(2),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(3)
		});

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var poll = await db.Polls.FirstAsync();
		var result = await service.GetPollAsync(
			TestAuthHelper.CreatePrincipal(memberId, communityId, isAdmin: true),
			poll.Id,
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var response = result.Response!;
		Assert.Multiple(() =>
		{
			Assert.That(response.TitleRequirement, Is.EqualTo(FieldRequirement.Optional));
			Assert.That(response.DescriptionRequirement, Is.EqualTo(FieldRequirement.Required));
			Assert.That(response.ImageRequirement, Is.EqualTo(FieldRequirement.Off));
		});
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
			PublicAssetId = asset2.Id,
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

	[Test]
	public async Task GetPoll_SubmissionOpen_NonAdminSeesTeaserOnly()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();
		var viewerId = Guid.NewGuid();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });

		db.CommunityMembers.AddRange(
			new CommunityMember
			{
				Id = submitterId,
				CommunityId = communityId,
				Platform = Platform.Discord,
				ExternalUserId = "submitter",
				DisplayName = "Submitter",
				JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
			},
			new CommunityMember
			{
				Id = viewerId,
				CommunityId = communityId,
				Platform = Platform.Discord,
				ExternalUserId = "viewer",
				DisplayName = "Viewer",
				JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1)
			});

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.SubmissionOpen,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddMinutes(-5),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddMinutes(5),
			VotingOpensAt = DateTimeOffset.UtcNow.AddDays(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(2)
		};

		var entryId = Guid.NewGuid();
		var originalAssetId = Guid.NewGuid();
		var teaserBlurHash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";
		var publicAssetId = Guid.NewGuid();

		db.Polls.Add(poll);
		db.PollEntries.Add(new PollEntry
		{
			Id = entryId,
			PollId = poll.Id,
			SubmittedByMemberId = submitterId,
			DisplayName = "Entry",
			OriginalAssetId = originalAssetId,
			TeaserBlurHash = teaserBlurHash,
			PublicAssetId = publicAssetId,
			CreatedAt = DateTimeOffset.UtcNow
		});

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(viewerId, communityId), poll.Id, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var entry = result.Response!.Entries.Single();
		Assert.Multiple(() =>
		{
			Assert.That(entry.OriginalAssetId, Is.Null);
			Assert.That(entry.PublicAssetId, Is.Null);
			Assert.That(entry.TeaserBlurHash, Is.EqualTo(teaserBlurHash));
		});
	}

	[Test]
	public async Task GetPoll_Review_OwnerSeesOriginalAndPublic()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var now = DateTimeOffset.UtcNow;

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });
		db.CommunityMembers.Add(new CommunityMember { Id = memberId, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "owner", DisplayName = "Owner", JoinedAt = now.AddMonths(-1) });

		var pollId = Guid.NewGuid();
		var entryId = Guid.NewGuid();
		var originalAssetId = Guid.NewGuid();
		var publicAssetId = Guid.NewGuid();
		var teaserBlurHash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = now.AddDays(-2),
			SubmissionClosesAt = now.AddDays(-1),
			VotingOpensAt = now.AddHours(1),
			VotingClosesAt = now.AddDays(1)
		});

		db.PollEntries.Add(new PollEntry
		{
			Id = entryId,
			PollId = pollId,
			SubmittedByMemberId = memberId,
			DisplayName = "Entry",
			OriginalAssetId = originalAssetId,
			PublicAssetId = publicAssetId,
			TeaserBlurHash = teaserBlurHash,
			CreatedAt = now.AddMinutes(-5)
		});

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var entry = result.Response!.Entries.Single();
		Assert.Multiple(() =>
		{
			Assert.That(entry.OriginalAssetId, Is.EqualTo(originalAssetId));
			Assert.That(entry.PublicAssetId, Is.EqualTo(publicAssetId));
			Assert.That(entry.TeaserBlurHash, Is.EqualTo(teaserBlurHash));
		});
	}

	[Test]
	public async Task GetPoll_VotingOpen_NonAdminHidesTallies()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var voterId = Guid.NewGuid();
		var otherId = Guid.NewGuid();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });
		db.CommunityMembers.AddRange(
			new CommunityMember { Id = voterId, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "voter", DisplayName = "Voter", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) },
			new CommunityMember { Id = otherId, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "other", DisplayName = "Other", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) });

		var pollId = Guid.NewGuid();
		var entryA = Guid.NewGuid();
		var entryB = Guid.NewGuid();

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.IRV,
			RequireRanking = true,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddMinutes(-5),
			VotingClosesAt = DateTimeOffset.UtcNow.AddMinutes(5)
		});

		db.PollEntries.AddRange(
			new PollEntry { Id = entryA, PollId = pollId, SubmittedByMemberId = voterId, DisplayName = "A", CreatedAt = DateTimeOffset.UtcNow.AddHours(-2) },
			new PollEntry { Id = entryB, PollId = pollId, SubmittedByMemberId = otherId, DisplayName = "B", CreatedAt = DateTimeOffset.UtcNow.AddHours(-1) });

		var vote = new Vote
		{
			Id = Guid.NewGuid(),
			PollId = pollId,
			MemberId = voterId,
			IsFinal = true,
			SubmittedAt = DateTimeOffset.UtcNow
		};

		db.Votes.Add(vote);
		db.VoteChoices.AddRange(
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote.Id, EntryId = entryA, Rank = 1 },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote.Id, EntryId = entryB, Rank = 2 });

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(otherId, communityId), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var response = result.Response!;
		Assert.That(response.Winners, Is.Empty);
		Assert.That(response.Entries.All(e => e.ApprovalVotes == 0));
		Assert.That(response.Entries.All(e => e.RankCounts.Count == 0));
	}

	[Test]
	public async Task GetPoll_Review_NonAdminHidesTalliesAndAuthors()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var reviewerId = Guid.NewGuid();
		var submitterA = Guid.NewGuid();
		var submitterB = Guid.NewGuid();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });
		db.CommunityMembers.AddRange(
			new CommunityMember { Id = reviewerId, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "reviewer", DisplayName = "Reviewer", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) },
			new CommunityMember { Id = submitterA, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "a", DisplayName = "Submitter A", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) },
			new CommunityMember { Id = submitterB, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "b", DisplayName = "Submitter B", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) });

		var pollId = Guid.NewGuid();
		var entryA = Guid.NewGuid();
		var entryB = Guid.NewGuid();
		var originalAssetA = Guid.NewGuid();
		var publicAssetA = Guid.NewGuid();
		var teaserBlurHashA = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.Review,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddDays(1)
		});

		db.PollEntries.AddRange(
			new PollEntry { Id = entryA, PollId = pollId, SubmittedByMemberId = submitterA, DisplayName = "Entry A", OriginalAssetId = originalAssetA, PublicAssetId = publicAssetA, TeaserBlurHash = teaserBlurHashA, CreatedAt = DateTimeOffset.UtcNow.AddHours(-2) },
			new PollEntry { Id = entryB, PollId = pollId, SubmittedByMemberId = submitterB, DisplayName = "Entry B", CreatedAt = DateTimeOffset.UtcNow.AddHours(-1) });

		var vote = new Vote { Id = Guid.NewGuid(), PollId = pollId, MemberId = submitterA, IsFinal = true, SubmittedAt = DateTimeOffset.UtcNow };
		db.Votes.Add(vote);
		db.VoteChoices.AddRange(
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote.Id, EntryId = entryA },
			new VoteChoice { Id = Guid.NewGuid(), VoteId = vote.Id, EntryId = entryB });

		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var result = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(reviewerId, communityId), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(PollOutcome.Ok));
		var response = result.Response!;
		Assert.Multiple(() =>
		{
			Assert.That(response.Winners, Is.Empty);
			Assert.That(response.Entries.All(e => e.ApprovalVotes == 0));
			Assert.That(response.Entries.All(e => e.RankCounts.Count == 0));
			Assert.That(response.Entries.All(e => string.IsNullOrEmpty(e.SubmittedByDisplayName)));
			Assert.That(response.Entries.All(e => e.Position is null));
			var entryAResponse = response.Entries.First(e => e.Id == entryA);
			Assert.That(entryAResponse.OriginalAssetId, Is.Null);
			Assert.That(entryAResponse.PublicAssetId, Is.Null);
			Assert.That(entryAResponse.TeaserBlurHash, Is.EqualTo(teaserBlurHashA));
		});
	}

	[Test]
	public async Task GetPoll_VotingOpen_OrderIsDeterministicPerUser()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();

		db.Communities.Add(new Community { Id = communityId, Platform = Platform.Discord, ExternalCommunityId = "guild", Name = "Guild" });

		var pollId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddMinutes(-5),
			VotingClosesAt = DateTimeOffset.UtcNow.AddMinutes(5)
		});

		var entries = Enumerable.Range(0, 5)
			.Select(i => new PollEntry
			{
				Id = Guid.NewGuid(),
				PollId = pollId,
				SubmittedByMemberId = submitterId,
				DisplayName = $"Entry {i}",
				CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-30 + i)
			})
			.ToList();

		db.PollEntries.AddRange(entries);
		await db.SaveChangesAsync();

		var sortedIds = entries.OrderBy(e => e.CreatedAt).Select(e => e.Id).ToList();
		var candidates = new[]
		{
			Guid.Parse("00000000-0000-0000-0000-000000000001"),
			Guid.Parse("00000000-0000-0000-0000-000000000002"),
			Guid.Parse("00000000-0000-0000-0000-000000000003"),
			Guid.Parse("00000000-0000-0000-0000-000000000004"),
			Guid.Parse("00000000-0000-0000-0000-000000000005"),
			Guid.Parse("00000000-0000-0000-0000-000000000006"),
			Guid.Parse("00000000-0000-0000-0000-000000000007"),
			Guid.Parse("00000000-0000-0000-0000-000000000008"),
			Guid.Parse("00000000-0000-0000-0000-000000000009"),
			Guid.Parse("00000000-0000-0000-0000-00000000000a")
		};

		var permutations = new List<(Guid MemberId, List<Guid> Order)>();
		foreach (var candidate in candidates)
		{
			var order = ShuffleDeterministicForTest(sortedIds, candidate, pollId);
			permutations.Add((candidate, order));
		}

		var first = permutations.First();
		var second = permutations.FirstOrDefault(p => !new SequenceComparer<Guid>().Equals(p.Order, first.Order));
		if (second.Order is null)
		{
			Assert.Fail("Unable to find distinct shuffled orders for test seeds");
		}

		var userA = first.MemberId;
		var userB = second.MemberId;
		var expectedOrderA = first.Order;
		var expectedOrderB = second.Order;

		db.CommunityMembers.AddRange(
			new CommunityMember { Id = submitterId, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "submitter", DisplayName = "Submitter", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) },
			new CommunityMember { Id = userA, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "userA", DisplayName = "User A", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) },
			new CommunityMember { Id = userB, CommunityId = communityId, Platform = Platform.Discord, ExternalUserId = "userB", DisplayName = "User B", JoinedAt = DateTimeOffset.UtcNow.AddMonths(-1) });
		await db.SaveChangesAsync();

		var service = new PollService(db, NullLogger<PollService>.Instance, new FakeAssetStorage());
		var resultA1 = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(userA, communityId), pollId, CancellationToken.None);
		var resultA2 = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(userA, communityId), pollId, CancellationToken.None);
		var resultB = await service.GetPollAsync(TestAuthHelper.CreatePrincipal(userB, communityId), pollId, CancellationToken.None);

		Assert.That(resultA1.Outcome, Is.EqualTo(PollOutcome.Ok));
		Assert.That(resultA2.Outcome, Is.EqualTo(PollOutcome.Ok));
		Assert.That(resultB.Outcome, Is.EqualTo(PollOutcome.Ok));

		var orderA1 = resultA1.Response!.Entries.Select(e => e.Id).ToList();
		var orderA2 = resultA2.Response!.Entries.Select(e => e.Id).ToList();
		var orderB = resultB.Response!.Entries.Select(e => e.Id).ToList();

		Assert.Multiple(() =>
		{
			Assert.That(orderA1, Is.EqualTo(expectedOrderA));
			Assert.That(orderA2, Is.EqualTo(expectedOrderA));
			Assert.That(orderB, Is.EqualTo(expectedOrderB));
			Assert.That(orderA1, Is.Not.EqualTo(orderB));
			Assert.That(resultA1.Response!.Entries.All(e => e.Position is null));
			Assert.That(resultB.Response!.Entries.All(e => e.Position is null));
		});
	}

	private static List<Guid> ShuffleDeterministicForTest(IReadOnlyList<Guid> items, Guid memberId, Guid pollId)
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

	private sealed class SequenceComparer<T> : IEqualityComparer<IReadOnlyList<T>> where T : notnull
	{
		public bool Equals(IReadOnlyList<T>? x, IReadOnlyList<T>? y)
		{
			if (ReferenceEquals(x, y)) return true;
			if (x is null || y is null || x.Count != y.Count) return false;
			for (var i = 0; i < x.Count; i++)
			{
				if (!EqualityComparer<T>.Default.Equals(x[i], y[i])) return false;
			}
			return true;
		}

		public int GetHashCode(IReadOnlyList<T> obj)
		{
			var hash = new HashCode();
			foreach (var item in obj)
			{
				hash.Add(item);
			}
			return hash.ToHashCode();
		}
	}
}
