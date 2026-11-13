using System.Security.Cryptography;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Options;
using OpenVoting.Data;

namespace OpenVoting.Server.Services;

public interface IAssetStorage
{
	Task<Asset> SaveAsync(IFormFile file, CancellationToken cancellationToken, AssetSaveOptions? options = null);
	Task<Asset> SaveAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken, AssetSaveOptions? options = null);
	Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken);
	Task DeleteAsync(string storageKey, CancellationToken cancellationToken);
}

public sealed class BlobAssetStorage : IAssetStorage
{
	private const string DefaultContentType = "application/octet-stream";

	private readonly BlobServiceClient _serviceClient;
	private readonly BlobStorageSettings _settings;

	public BlobAssetStorage(BlobServiceClient serviceClient, IOptions<Settings> options)
	{
		_serviceClient = serviceClient;
		_settings = options.Value.BlobStorage;
	}

	public async Task<Asset> SaveAsync(IFormFile file, CancellationToken cancellationToken, AssetSaveOptions? options = null)
	{
		if (file == null || file.Length == 0)
		{
			throw new InvalidOperationException("File is required");
		}

		if (options?.MaxBytes is long maxBytes && file.Length > maxBytes)
		{
			throw new InvalidOperationException($"File exceeds the allowed limit of {maxBytes / (1024 * 1024)} MB");
		}

		await using var buffer = new MemoryStream();
		await file.CopyToAsync(buffer, cancellationToken);
		buffer.Position = 0;

		var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? DefaultContentType : file.ContentType;
		return await SaveAsync(buffer, file.FileName, contentType, cancellationToken, options);
	}

	public async Task<Asset> SaveAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken, AssetSaveOptions? options = null)
	{
		if (content == null)
		{
			throw new InvalidOperationException("File is required");
		}

		var workingStream = await ToMemoryStreamAsync(content, cancellationToken);

		if (options?.MaxBytes is long maxBytes && workingStream.Length > maxBytes)
		{
			throw new InvalidOperationException($"File exceeds the allowed limit of {maxBytes / (1024 * 1024)} MB");
		}

		var processed = ProcessImage(workingStream, contentType, options);

		if (options?.MaxBytes is long maxProcessedBytes && processed.Buffer.Length > maxProcessedBytes)
		{
			throw new InvalidOperationException($"Processed file exceeds the allowed limit of {maxProcessedBytes / (1024 * 1024)} MB");
		}

		var container = _serviceClient.GetBlobContainerClient(_settings.ContainerName);
		await container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);

		var extension = Path.GetExtension(fileName);
		if (string.IsNullOrWhiteSpace(extension))
		{
			extension = ".bin";
		}

		if (options?.NormalizeToPng == true)
		{
			extension = ".png";
		}

		var key = $"assets/{DateTimeOffset.UtcNow:yyyy/MM/dd}/{Guid.NewGuid()}{extension}";

		processed.Buffer.Position = 0;
		var headers = new BlobHttpHeaders
		{
			ContentType = processed.ContentType
		};

		var blob = container.GetBlobClient(key);
		await blob.UploadAsync(processed.Buffer, new BlobUploadOptions { HttpHeaders = headers }, cancellationToken);

		return new Asset
		{
			Id = Guid.NewGuid(),
			StorageKey = key,
			ContentType = processed.ContentType,
			Bytes = processed.Buffer.Length,
			Width = processed.Width,
			Height = processed.Height,
			Sha256 = processed.Hash,
			CreatedAt = DateTimeOffset.UtcNow
		};
	}

	public async Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
	{
		if (string.IsNullOrWhiteSpace(storageKey))
		{
			throw new InvalidOperationException("Storage key is required");
		}

		var container = _serviceClient.GetBlobContainerClient(_settings.ContainerName);
		var blob = container.GetBlobClient(storageKey);
		return await blob.OpenReadAsync(new BlobOpenReadOptions(false), cancellationToken);
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

	private static async Task<MemoryStream> ToMemoryStreamAsync(Stream content, CancellationToken cancellationToken)
	{
		if (content is MemoryStream ms && content.CanSeek)
		{
			content.Position = 0;
			return ms;
		}

		var buffer = new MemoryStream();
		await content.CopyToAsync(buffer, cancellationToken);
		buffer.Position = 0;
		return buffer;
	}

	private static ProcessedImage ProcessImage(MemoryStream source, string contentType, AssetSaveOptions? options)
	{
		var info = Identify(source, options);
		var requiresProcessing = options?.ResizeTo.HasValue == true || options?.ApplyBlur == true || options?.NormalizeToPng == true;

		if (!requiresProcessing)
		{
			source.Position = 0;
			var normalizedType = NormalizeContentType(contentType);
			var hash = ComputeHash(source);
			return new ProcessedImage(source, normalizedType, info.Width, info.Height, hash);
		}

		var (buffer, width, height) = ImageProcessor.ToPng(source, options?.ResizeTo, options?.ApplyBlur == true);
		var hashProcessed = ComputeHash(buffer);
		return new ProcessedImage(buffer, "image/png", width, height, hashProcessed);
	}

	private static (int Width, int Height) Identify(Stream stream, AssetSaveOptions? options)
	{
		var info = ImageProcessor.Identify(stream);

		if (options?.RequireSquare == true && info.Width != info.Height)
		{
			throw new InvalidOperationException("Image must have a 1:1 aspect ratio");
		}

		if (options?.MinDimension is int min && (info.Width < min || info.Height < min))
		{
			throw new InvalidOperationException($"Image must be at least {min}x{min}");
		}

		return info;
	}

	private static string NormalizeContentType(string contentType)
	{
		return string.IsNullOrWhiteSpace(contentType) ? DefaultContentType : contentType;
	}

	private static string ComputeHash(MemoryStream buffer)
	{
		buffer.Position = 0;
		using var hasher = SHA256.Create();
		var hash = hasher.ComputeHash(buffer);
		buffer.Position = 0;
		return Convert.ToHexString(hash);
	}

	private sealed record ProcessedImage(MemoryStream Buffer, string ContentType, int Width, int Height, string Hash);
}
