using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using SkiaSharp;

namespace OpenVoting.Server.Tests;

public class BlobAssetStorageTests
{
	// Validation runs before any blob call, so the storage account is never contacted
	private static BlobAssetStorage CreateStorage()
	{
		return new BlobAssetStorage(new BlobServiceClient("UseDevelopmentStorage=true"), Options.Create(new Settings()));
	}

	private static readonly AssetSaveOptions UploadOptions = new() { RequireSquare = true, MinDimension = 64 };

	[Test]
	public async Task SaveAsync_WithNonImage_ThrowsInvalidOperation()
	{
		var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
			CreateStorage().SaveAsync(new MemoryStream("not an image"u8.ToArray()), "file.png", "image/png", CancellationToken.None, UploadOptions));

		Assert.That(ex!.Message, Is.EqualTo("Images must be PNG, JPEG, GIF, WebP or BMP"));
	}

	[Test]
	public async Task SaveAsync_WithNonSquareImage_ThrowsInvalidOperation()
	{
		var png = TestImages.Png(128, 64, (_, _) => SKColors.Red);

		var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
			CreateStorage().SaveAsync(new MemoryStream(png), "file.png", "image/png", CancellationToken.None, UploadOptions));

		Assert.That(ex!.Message, Is.EqualTo("Image must have a 1:1 aspect ratio"));
	}

	[Test]
	public async Task SaveAsync_WithSmallImage_ThrowsInvalidOperation()
	{
		var png = TestImages.Png(32, 32, (_, _) => SKColors.Red);

		var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
			CreateStorage().SaveAsync(new MemoryStream(png), "file.png", "image/png", CancellationToken.None, UploadOptions));

		Assert.That(ex!.Message, Is.EqualTo("Image must be at least 64x64"));
	}
}
