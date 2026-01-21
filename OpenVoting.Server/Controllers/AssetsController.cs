using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Server.Auth;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class AssetsController : ControllerBase
{
	private readonly ApplicationDbContext _db;
	private readonly IAssetStorage _storage;
	private readonly BlobStorageSettings _blobSettings;

	public AssetsController(ApplicationDbContext db, IAssetStorage storage, IOptions<Settings> options)
	{
		_db = db;
		_storage = storage;
		_blobSettings = options.Value.BlobStorage;
	}

	[HttpPost]
	[RequestSizeLimit(50 * 1024 * 1024)]
	[Consumes("multipart/form-data")]
	public async Task<ActionResult<AssetResponse>> Upload([FromForm] IFormFile file, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		if (file == null || file.Length == 0)
		{
			return BadRequest("File is required");
		}

		var asset = await _storage.SaveAsync(file, cancellationToken);

		_db.Assets.Add(asset);
		await _db.SaveChangesAsync(cancellationToken);

		return Ok(ToResponse(asset));
	}

	[HttpGet("{id:guid}")]
	public async Task<ActionResult<AssetResponse>> Get(Guid id, CancellationToken cancellationToken)
	{
		var authUser = AuthenticatedUser.FromPrincipal(User);
		if (authUser is null)
		{
			return Unauthorized();
		}

		var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
		if (asset is null)
		{
			return NotFound();
		}

		return Ok(ToResponse(asset));
	}

	private AssetResponse ToResponse(Asset asset)
	{
		var url = string.IsNullOrWhiteSpace(_blobSettings.PublicBaseUrl)
			? null
			: $"{_blobSettings.PublicBaseUrl.TrimEnd('/')}/{asset.StorageKey}";

		return new AssetResponse
		{
			Id = asset.Id,
			StorageKey = asset.StorageKey,
			ContentType = asset.ContentType,
			Bytes = asset.Bytes,
			Sha256 = asset.Sha256,
			Url = url
		};
	}
}

public sealed class AssetResponse
{
	public Guid Id { get; init; }
	public string StorageKey { get; init; } = string.Empty;
	public string ContentType { get; init; } = string.Empty;
	public long Bytes { get; init; }
	public string Sha256 { get; init; } = string.Empty;
	public string? Url { get; init; }
}
