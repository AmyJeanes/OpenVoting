using Microsoft.AspNetCore.Http;
using OpenVoting.Data;
using OpenVoting.Server.Services;

namespace OpenVoting.Server.Tests.Helpers;

internal sealed class FakeAssetStorage : IAssetStorage
{
	private readonly Dictionary<string, byte[]> _store = new();

	public List<string> DeletedKeys { get; } = new();

	public Asset SaveAssetFromBytes(byte[] content, string contentType = "image/png", string? storageKey = null)
	{
		var key = storageKey ?? $"assets/{Guid.NewGuid():N}.bin";
		_store[key] = content;

		return new Asset
		{
			Id = Guid.NewGuid(),
			StorageKey = key,
			ContentType = contentType,
			Bytes = content.Length,
			CreatedAt = DateTimeOffset.UtcNow
		};
	}

	public Task<Asset> SaveAsync(IFormFile file, CancellationToken cancellationToken, AssetSaveOptions? options = null)
	{
		if (file == null)
		{
			throw new InvalidOperationException("File is required");
		}

		return SaveAsync(file.OpenReadStream(), file.FileName, file.ContentType ?? "application/octet-stream", cancellationToken, options);
	}

	public async Task<Asset> SaveAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken, AssetSaveOptions? options = null)
	{
		if (content == null)
		{
			throw new InvalidOperationException("File is required");
		}

		await using var buffer = new MemoryStream();
		await content.CopyToAsync(buffer, cancellationToken);
		var data = buffer.ToArray();

		if (options?.MaxBytes is long max && data.Length > max)
		{
			throw new InvalidOperationException($"File exceeds the allowed limit of {max / (1024 * 1024)} MB");
		}

		var extension = Path.GetExtension(fileName);
		if (string.IsNullOrWhiteSpace(extension))
		{
			extension = ".bin";
		}

		var key = $"assets/{Guid.NewGuid():N}{extension}";
		_store[key] = data;

		return new Asset
		{
			Id = Guid.NewGuid(),
			StorageKey = key,
			ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
			Bytes = data.Length,
			Sha256 = string.Empty,
			CreatedAt = DateTimeOffset.UtcNow
		};
	}

	public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
	{
		if (!_store.TryGetValue(storageKey, out var data))
		{
			throw new InvalidOperationException($"Storage key not found: {storageKey}");
		}

		Stream stream = new MemoryStream(data, writable: false);
		return Task.FromResult(stream);
	}

	public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(storageKey))
		{
			return Task.CompletedTask;
		}

		DeletedKeys.Add(storageKey);
		_store.Remove(storageKey);
		return Task.CompletedTask;
	}

	public void RegisterAsset(Asset asset, byte[] content)
	{
		_store[asset.StorageKey] = content;
	}
}
