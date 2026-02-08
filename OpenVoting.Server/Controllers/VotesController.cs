using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenVoting.Server.Contracts;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/polls/{pollId:guid}/vote")]
[Authorize]
public sealed class VotesController : ControllerBase
{
	private readonly IVoteService _voteService;

	public VotesController(IVoteService voteService)
	{
		_voteService = voteService;
	}

	[HttpGet]
	public async Task<ActionResult<VoteResponse>> Get(Guid pollId, CancellationToken cancellationToken)
	{
		var result = await _voteService.GetAsync(User, pollId, cancellationToken);
		return ToActionResult(result);
	}

	[HttpPost]
	public async Task<ActionResult<VoteResponse>> Submit(Guid pollId, [FromBody] SubmitVoteRequest request, CancellationToken cancellationToken)
	{
		var result = await _voteService.SubmitAsync(User, pollId, request, cancellationToken);
		return ToActionResult(result);
	}

	private ActionResult<VoteResponse> ToActionResult(VoteServiceResult result)
	{
		return result.Outcome switch
		{
			VoteServiceOutcome.Ok => Ok(result.Response),
			VoteServiceOutcome.NoContent => NoContent(),
			VoteServiceOutcome.NotFound => NotFound(),
			VoteServiceOutcome.Unauthorized => Unauthorized(),
			VoteServiceOutcome.Forbidden => Problem(statusCode: StatusCodes.Status403Forbidden, detail: result.Message ?? "Forbidden"),
			VoteServiceOutcome.BadRequest => BadRequest(result.Message),
			_ => Problem(statusCode: StatusCodes.Status500InternalServerError)
		};
	}
}
