using System.Security.Cryptography;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Options;
using OpenVoting.Data;

namespace OpenVoting.Server.Services;

public interface IAssetStorage
{
	Task<Asset> SaveAsync(IFormFile file, CancellationToken cancellationToken);
	Task DeleteAsync(string storageKey, CancellationToken cancellationToken);
}

public sealed class BlobAssetStorage : IAssetStorage
{
	private readonly BlobServiceClient _serviceClient;
	private readonly BlobStorageSettings _settings;

	public BlobAssetStorage(BlobServiceClient serviceClient, IOptions<Settings> options)
	{
		_serviceClient = serviceClient;
		_settings = options.Value.BlobStorage;
	}

	public async Task<Asset> SaveAsync(IFormFile file, CancellationToken cancellationToken)
	{
		if (file == null || file.Length == 0)
		{
			throw new InvalidOperationException("File is required");
		}

		var container = _serviceClient.GetBlobContainerClient(_settings.ContainerName);
		await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

		var extension = Path.GetExtension(file.FileName);
		var key = $"assets/{DateTimeOffset.UtcNow:yyyy/MM/dd}/{Guid.NewGuid()}{extension}";

		await using var buffer = new MemoryStream();
		await file.CopyToAsync(buffer, cancellationToken);
		buffer.Position = 0;

		string sha;
		using (var hasher = SHA256.Create())
		{
			sha = Convert.ToHexString(hasher.ComputeHash(buffer));
		}

		buffer.Position = 0;

		var headers = new BlobHttpHeaders
		{
			ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType
		};

		var blob = container.GetBlobClient(key);
		await blob.UploadAsync(buffer, new BlobUploadOptions { HttpHeaders = headers }, cancellationToken);

		return new Asset
		{
			Id = Guid.NewGuid(),
			StorageKey = key,
			ContentType = headers.ContentType,
			Bytes = buffer.Length,
			Sha256 = sha,
			CreatedAt = DateTimeOffset.UtcNow
		};
	}

	public async Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(storageKey))
		{
			return;
		}

		var container = _serviceClient.GetBlobContainerClient(_settings.ContainerName);
		var blob = container.GetBlobClient(storageKey);
		await blob.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: cancellationToken);
	}
}
