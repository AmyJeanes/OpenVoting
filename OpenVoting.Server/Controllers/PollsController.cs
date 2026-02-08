using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class PollsController : ControllerBase
{
	private readonly IPollService _pollService;

	public PollsController(IPollService pollService)
	{
		_pollService = pollService;
	}

	[HttpGet("current")]
	public async Task<ActionResult<PollResponse>> GetCurrent(CancellationToken cancellationToken)
	{
		var result = await _pollService.GetCurrentAsync(User, cancellationToken);
		return ToActionResult(result);
	}

	[HttpGet("active")]
	public async Task<ActionResult<IReadOnlyList<PollResponse>>> GetActive(CancellationToken cancellationToken)
	{
		var result = await _pollService.GetActiveAsync(User, cancellationToken);
		return ToActionResult(result);
	}

	[HttpGet("{id:guid}/summary")]
	public async Task<ActionResult<PollResponse>> GetSummary(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.GetSummaryAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpGet("history")]
	public async Task<ActionResult<IReadOnlyList<PollHistoryResponse>>> GetHistory(CancellationToken cancellationToken)
	{
		var result = await _pollService.GetHistoryAsync(User, cancellationToken);
		return ToActionResult(result);
	}

	[HttpGet("{id:guid}")]
	public async Task<ActionResult<PollDetailResponse>> GetPoll(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.GetPollAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpGet("{id:guid}/tally")]
	public async Task<ActionResult<IReadOnlyList<VotingBreakdownEntryResponse>>> GetVotingBreakdown(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.GetVotingBreakdownAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost]
	public async Task<ActionResult<PollResponse>> Create([FromBody] CreatePollRequest request, CancellationToken cancellationToken)
	{
		var result = await _pollService.CreateAsync(User, request, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPatch("{id:guid}")]
	public async Task<ActionResult<PollResponse>> Update(Guid id, [FromBody] UpdatePollMetadataRequest request, CancellationToken cancellationToken)
	{
		var result = await _pollService.UpdateMetadataAsync(User, id, request, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPatch("{id:guid}/submission-settings")]
	public async Task<ActionResult<PollResponse>> UpdateSubmissionSettings(Guid id, [FromBody] UpdateSubmissionSettingsRequest request, CancellationToken cancellationToken)
	{
		var result = await _pollService.UpdateSubmissionSettingsAsync(User, id, request, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPatch("{id:guid}/voting-settings")]
	public async Task<ActionResult<PollResponse>> UpdateVotingSettings(Guid id, [FromBody] UpdateVotingSettingsRequest request, CancellationToken cancellationToken)
	{
		var result = await _pollService.UpdateVotingSettingsAsync(User, id, request, cancellationToken);
		return ToActionResult(result);
	}

	[HttpDelete("{id:guid}")]
	public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.DeleteAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost("{id:guid}/open-submissions")]
	public async Task<ActionResult<PollResponse>> OpenSubmissions(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.OpenSubmissionsAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost("{id:guid}/start-review")]
	public async Task<ActionResult<PollResponse>> StartReview(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.StartReviewAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost("{id:guid}/open-voting")]
	public async Task<ActionResult<PollResponse>> OpenVoting(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.OpenVotingAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost("{id:guid}/close")]
	public async Task<ActionResult<PollResponse>> Close(Guid id, CancellationToken cancellationToken)
	{
		var result = await _pollService.CloseAsync(User, id, cancellationToken);
		return ToActionResult(result);
	}

	private ActionResult ToActionResult<T>(PollResult<T> result)
	{
		return result.Outcome switch
		{
			PollOutcome.Unauthorized => Unauthorized(),
			PollOutcome.NotFound => NotFound(),
			PollOutcome.Forbidden => Problem(statusCode: StatusCodes.Status403Forbidden, detail: result.Message),
			PollOutcome.BadRequest => BadRequest(result.Message),
			PollOutcome.NoContent => NoContent(),
			_ => Ok(result.Response)
		};
	}
}
