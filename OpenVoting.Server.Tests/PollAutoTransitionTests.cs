using Microsoft.Extensions.Logging.Abstractions;
using OpenVoting.Data;
using OpenVoting.Data.Enums;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using NUnit.Framework;

namespace OpenVoting.Server.Tests;

public class PollAutoTransitionTests
{
	[Test]
	public async Task ApplyAsync_MovesThroughWindowsAndLocksVoting()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = Guid.NewGuid(),
			Status = PollStatus.SubmissionOpen,
			VotingMethod = VotingMethod.IRV,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddMinutes(-10),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddMinutes(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddSeconds(-1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddMinutes(5)
		};

		db.Polls.Add(poll);
		await db.SaveChangesAsync();

		var changed = await PollAutoTransition.ApplyAsync(db, poll, NullLogger.Instance, CancellationToken.None);

		Assert.That(changed, Is.True);
		Assert.That(poll.Status, Is.EqualTo(PollStatus.VotingOpen));
		Assert.That(poll.LockedAt, Is.Not.Null);
		Assert.That(poll.RequireRanking, Is.True);
	}

	[Test]
	public async Task ApplyAsync_NoChanges_ReturnsFalse()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = Guid.NewGuid(),
			Status = PollStatus.Draft,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			SubmissionClosesAt = DateTimeOffset.MaxValue,
			VotingOpensAt = DateTimeOffset.MaxValue,
			VotingClosesAt = DateTimeOffset.MaxValue
		};

		db.Polls.Add(poll);
		await db.SaveChangesAsync();

		var changed = await PollAutoTransition.ApplyAsync(db, poll, NullLogger.Instance, CancellationToken.None);

		Assert.That(changed, Is.False);
		Assert.That(poll.Status, Is.EqualTo(PollStatus.Draft));
	}
}
