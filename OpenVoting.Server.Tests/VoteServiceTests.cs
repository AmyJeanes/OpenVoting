using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using NUnit.Framework;

namespace OpenVoting.Server.Tests;

public class VoteServiceTests
{
	[Test]
	public async Task Get_WhenNoVote_ReturnsNoContent()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var pollId = Guid.NewGuid();

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(1)
		});

		await db.SaveChangesAsync();

		var service = new VoteService(db, NullLogger<VoteService>.Instance);
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, communityId), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.NoContent));
	}

	[Test]
	public async Task Get_WhenUnauthorized_ReturnsUnauthorized()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var service = new VoteService(db, NullLogger<VoteService>.Instance);

		var result = await service.GetAsync(new System.Security.Claims.ClaimsPrincipal(), Guid.NewGuid(), CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.Unauthorized));
	}

	[Test]
	public async Task Get_WhenPollNotInMemberCommunity_ReturnsNotFound()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var memberCommunityId = Guid.NewGuid();
		var otherCommunityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var pollId = Guid.NewGuid();

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = memberCommunityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = otherCommunityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(1)
		});

		await db.SaveChangesAsync();

		var service = new VoteService(db, NullLogger<VoteService>.Instance);
		var result = await service.GetAsync(TestAuthHelper.CreatePrincipal(memberId, memberCommunityId), pollId, CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.NotFound));
	}

	[Test]
	public async Task Submit_WhenVotingNotOpen_ReturnsForbidden()
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
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.SubmissionOpen,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-1),
			SubmissionClosesAt = DateTimeOffset.MaxValue,
			VotingOpensAt = DateTimeOffset.MaxValue,
			VotingClosesAt = DateTimeOffset.MaxValue
		});

		await db.SaveChangesAsync();

		var poll = await db.Polls.FirstAsync();
		var service = new VoteService(db, NullLogger<VoteService>.Instance);
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(memberId, communityId),
			poll.Id,
			new SubmitVoteRequest { Choices = new List<VoteSelection> { new() { EntryId = Guid.NewGuid() } } },
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.Forbidden));
		Assert.That(result.Message, Is.EqualTo("Voting is not open"));
	}

	[Test]
	public async Task Submit_WithDuplicateEntries_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var pollId = Guid.NewGuid();

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(1)
		});

		var entryId = Guid.NewGuid();
		db.PollEntries.Add(new PollEntry
		{
			Id = entryId,
			PollId = pollId,
			SubmittedByMemberId = memberId,
			DisplayName = "Entry"
		});

		await db.SaveChangesAsync();

		var service = new VoteService(db, NullLogger<VoteService>.Instance);
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(memberId, communityId),
			pollId,
			new SubmitVoteRequest
			{
				Choices = new List<VoteSelection>
				{
					new() { EntryId = entryId },
					new() { EntryId = entryId }
				}
			},
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.BadRequest));
		Assert.That(result.Message, Is.EqualTo("Duplicate entries are not allowed"));
	}

	[Test]
	public async Task Submit_IrvWithDuplicateRanks_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var pollId = Guid.NewGuid();

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.IRV,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(1)
		});

		var entryA = Guid.NewGuid();
		var entryB = Guid.NewGuid();

		db.PollEntries.AddRange(
			new PollEntry { Id = entryA, PollId = pollId, SubmittedByMemberId = memberId, DisplayName = "A" },
			new PollEntry { Id = entryB, PollId = pollId, SubmittedByMemberId = memberId, DisplayName = "B" });

		await db.SaveChangesAsync();

		var service = new VoteService(db, NullLogger<VoteService>.Instance);
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(memberId, communityId),
			pollId,
			new SubmitVoteRequest
			{
				Choices = new List<VoteSelection>
				{
					new() { EntryId = entryA, Rank = 1 },
					new() { EntryId = entryB, Rank = 1 }
				}
			},
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.BadRequest));
		Assert.That(result.Message, Is.EqualTo("Ranks must be unique and between 1 and the number of choices"));
	}

	[Test]
	public async Task Submit_SuccessfullyCreatesVoteAndChoices()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();
		var pollId = Guid.NewGuid();

		db.CommunityMembers.Add(new CommunityMember
		{
			Id = memberId,
			CommunityId = communityId,
			Platform = Platform.Discord,
			ExternalUserId = "user",
			DisplayName = "Member",
			JoinedAt = DateTimeOffset.UtcNow
		});

		db.Polls.Add(new Poll
		{
			Id = pollId,
			CommunityId = communityId,
			Status = PollStatus.VotingOpen,
			VotingMethod = VotingMethod.Approval,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(1)
		});

		var entryA = Guid.NewGuid();
		var entryB = Guid.NewGuid();

		db.PollEntries.AddRange(
			new PollEntry { Id = entryA, PollId = pollId, SubmittedByMemberId = memberId, DisplayName = "A" },
			new PollEntry { Id = entryB, PollId = pollId, SubmittedByMemberId = memberId, DisplayName = "B" });

		await db.SaveChangesAsync();

		var service = new VoteService(db, NullLogger<VoteService>.Instance);
		var result = await service.SubmitAsync(
			TestAuthHelper.CreatePrincipal(memberId, communityId),
			pollId,
			new SubmitVoteRequest
			{
				Choices = new List<VoteSelection>
				{
					new() { EntryId = entryA },
					new() { EntryId = entryB }
				}
			},
			CancellationToken.None);

		Assert.That(result.Outcome, Is.EqualTo(VoteServiceOutcome.Ok));
		Assert.That(await db.Votes.CountAsync(), Is.EqualTo(1));
		Assert.That(await db.VoteChoices.CountAsync(), Is.EqualTo(2));

		var vote = await db.Votes.Include(v => v.Choices).FirstAsync();
		Assert.That(vote.IsFinal, Is.True);
		Assert.That(vote.SubmittedAt, Is.Not.Null);
	}
}
