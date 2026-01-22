using Microsoft.EntityFrameworkCore;
using OpenVoting.Data;
using OpenVoting.Data.Enums;

namespace OpenVoting.Server.Services;

public static class PollAutoTransition
{
	public static async Task<bool> ApplyAsync(ApplicationDbContext db, Poll poll, ILogger logger, CancellationToken cancellationToken)
	{
		var now = DateTimeOffset.UtcNow;
		var changed = false;

		if (poll.Status == PollStatus.SubmissionOpen && poll.SubmissionClosesAt != DateTimeOffset.MaxValue && now >= poll.SubmissionClosesAt)
		{
			poll.Status = PollStatus.Review;
			poll.SubmissionClosesAt = poll.SubmissionClosesAt > now ? now : poll.SubmissionClosesAt;
			changed = true;
		}

		if (poll.Status == PollStatus.Review && now >= poll.VotingOpensAt)
		{
			poll.Status = PollStatus.VotingOpen;
			if (poll.VotingOpensAt > now)
			{
				poll.VotingOpensAt = now;
			}
			poll.LockedAt ??= now;
			changed = true;
		}

		if (poll.Status == PollStatus.VotingOpen && poll.VotingClosesAt != DateTimeOffset.MaxValue && now >= poll.VotingClosesAt)
		{
			poll.Status = PollStatus.Closed;
			poll.VotingClosesAt = poll.VotingClosesAt > now ? now : poll.VotingClosesAt;
			changed = true;
		}

		if (!changed)
		{
			return false;
		}

		poll.RequireRanking = poll.VotingMethod == VotingMethod.IRV;

		try
		{
			await db.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateConcurrencyException ex)
		{
			logger.LogWarning(ex, "Failed to save automatic transition for poll {PollId}", poll.Id);
			return false;
		}

		return true;
	}
}