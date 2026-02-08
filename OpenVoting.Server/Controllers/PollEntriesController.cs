using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/polls/{pollId:guid}/entries")]
[Authorize]
public sealed class PollEntriesController : ControllerBase
{
	private readonly IPollEntryService _pollEntryService;

	public PollEntriesController(IPollEntryService pollEntryService)
	{
		_pollEntryService = pollEntryService;
	}

	[HttpGet]
	public async Task<ActionResult<IReadOnlyList<PollEntryResponse>>> Get(Guid pollId, CancellationToken cancellationToken)
	{
		var result = await _pollEntryService.GetAsync(User, pollId, cancellationToken);
		return ToActionResult(result);
	}

	[HttpDelete("{entryId:guid}")]
	public async Task<IActionResult> Delete(Guid pollId, Guid entryId, CancellationToken cancellationToken)
	{
		var result = await _pollEntryService.DeleteAsync(User, pollId, entryId, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost("{entryId:guid}/disqualify")]
	public async Task<ActionResult<PollEntryResponse>> Disqualify(Guid pollId, Guid entryId, [FromBody] DisqualifyEntryRequest request, CancellationToken cancellationToken)
	{
		var result = await _pollEntryService.DisqualifyAsync(User, pollId, entryId, request, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost("{entryId:guid}/requalify")]
	public async Task<ActionResult<PollEntryResponse>> Requalify(Guid pollId, Guid entryId, CancellationToken cancellationToken)
	{
		var result = await _pollEntryService.RequalifyAsync(User, pollId, entryId, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost]
	public async Task<ActionResult<PollEntryResponse>> Submit(Guid pollId, [FromBody] SubmitEntryRequest request, CancellationToken cancellationToken)
	{
		var result = await _pollEntryService.SubmitAsync(User, pollId, request, cancellationToken);
		return ToActionResult(result);
	}

	private ActionResult ToActionResult<T>(PollEntryResult<T> result)
	{
		return result.Outcome switch
		{
			PollEntryOutcome.Unauthorized => Unauthorized(),
			PollEntryOutcome.NotFound => NotFound(),
			PollEntryOutcome.Forbidden => Problem(statusCode: StatusCodes.Status403Forbidden, detail: result.Message),
			PollEntryOutcome.BadRequest => BadRequest(result.Message),
			PollEntryOutcome.NoContent => NoContent(),
			_ => Ok(result.Response)
		};
	}
}
