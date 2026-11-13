using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using SkiaSharp;

namespace OpenVoting.Server.Tests;

public class ImageProcessorTests
{
	private static readonly SKColor Red = new(255, 0, 0);
	private static readonly SKColor Green = new(0, 255, 0);
	private static readonly SKColor Blue = new(0, 0, 255);

	// Expected values were produced by the previous Blurhash.ImageSharp encoder from the same pixels
	[TestCase(64, 48, "L$HVD12Z$5Shl}axjtf5gcfjfQfj")]
	[TestCase(600, 600, "L%HV9^2F$5SNdMfOfQfOgcfQfQfQ")]
	public void CreateBlurHash_MatchesPreviousEncoder(int width, int height, string expected)
	{
		var png = TestImages.Png(width, height, (x, y) => TestImages.Gradient(x, y, width, height));

		var blurHash = ImageProcessor.CreateBlurHash(new MemoryStream(png), 4, 3);

		Assert.That(blurHash, Is.EqualTo(expected));
	}

	[Test]
	public void CreateBlurHash_WithTransparency_MatchesPreviousEncoder()
	{
		var png = TestImages.Png(96, 64, (x, y) => new SKColor((byte)(x * 255 / 95), (byte)(y * 255 / 63), 100, (byte)(x < 48 ? 0 : 255)));

		var blurHash = ImageProcessor.CreateBlurHash(new MemoryStream(png), 4, 3);

		Assert.That(blurHash, Is.EqualTo("L%HV972Y$5Sghpazjtf7gcfQfQfQ"));
	}

	[Test]
	public void CreateBlurHash_FollowsExifOrientation()
	{
		var jpeg = TestImages.Jpeg(40, 20, (x, _) => x < 20 ? Red : Blue, exifOrientation: 6);
		var (upright, _, _) = ImageProcessor.ToPng(new MemoryStream(jpeg), null, false);

		var fromJpeg = ImageProcessor.CreateBlurHash(new MemoryStream(jpeg), 4, 3);
		var fromUpright = ImageProcessor.CreateBlurHash(upright, 4, 3);

		Assert.That(fromJpeg, Is.EqualTo(fromUpright));
	}

	[Test]
	public void Identify_ReturnsDimensions()
	{
		var png = TestImages.Png(300, 200, (x, y) => TestImages.Gradient(x, y, 300, 200));

		Assert.That(ImageProcessor.Identify(new MemoryStream(png)), Is.EqualTo((300, 200)));
	}

	[Test]
	public void Identify_SwapsDimensionsForRotatedExifOrientation()
	{
		var jpeg = TestImages.Jpeg(40, 20, (_, _) => Red, exifOrientation: 6);

		Assert.That(ImageProcessor.Identify(new MemoryStream(jpeg)), Is.EqualTo((20, 40)));
	}

	[Test]
	public void ToPng_WithoutResize_ConvertsToPngAtOriginalSize()
	{
		var jpeg = TestImages.Jpeg(120, 80, (x, y) => TestImages.Gradient(x, y, 120, 80));

		var (png, width, height) = ImageProcessor.ToPng(new MemoryStream(jpeg), null, false);

		using var codec = SKCodec.Create(png);
		Assert.Multiple(() =>
		{
			Assert.That((width, height), Is.EqualTo((120, 80)));
			Assert.That(codec.EncodedFormat, Is.EqualTo(SKEncodedImageFormat.Png));
			Assert.That((codec.Info.Width, codec.Info.Height), Is.EqualTo((120, 80)));
		});
	}

	[Test]
	public void ToPng_WithResize_CropsCentreSquare()
	{
		var png = TestImages.Png(300, 100, (x, _) => x < 100 ? Red : x < 200 ? Green : Blue);

		var (output, width, height) = ImageProcessor.ToPng(new MemoryStream(png), 50, false);

		using var bitmap = TestImages.Decode(output.ToArray());
		Assert.Multiple(() =>
		{
			Assert.That((width, height), Is.EqualTo((50, 50)));
			Assert.That((bitmap.Width, bitmap.Height), Is.EqualTo((50, 50)));
			foreach (var (x, y) in new[] { (0, 0), (49, 0), (25, 25), (0, 49), (49, 49) })
			{
				var pixel = bitmap.GetPixel(x, y);
				Assert.That(pixel.Green, Is.GreaterThan(240), $"green at {x},{y}");
				Assert.That(pixel.Red, Is.LessThan(15), $"red at {x},{y}");
				Assert.That(pixel.Blue, Is.LessThan(15), $"blue at {x},{y}");
			}
		});
	}

	[Test]
	public void ToPng_WithLargeDownscale_AveragesFineDetail()
	{
		var png = TestImages.Png(1024, 1024, (x, y) => (x + y) % 2 == 0 ? SKColors.Black : SKColors.White);

		var (output, _, _) = ImageProcessor.ToPng(new MemoryStream(png), 64, false);

		using var bitmap = TestImages.Decode(output.ToArray());
		var values = Enumerable.Range(0, 64).SelectMany(y => Enumerable.Range(0, 64).Select(x => (int)bitmap.GetPixel(x, y).Red)).ToList();
		Assert.That(values, Is.All.InRange(118, 138));
	}

	[Test]
	public void ToPng_WithBlur_KeepsSizeAndOpaqueEdges()
	{
		var png = TestImages.Png(200, 200, (x, _) => x < 100 ? SKColors.Black : SKColors.White);

		var (output, width, height) = ImageProcessor.ToPng(new MemoryStream(png), null, true);

		using var bitmap = TestImages.Decode(output.ToArray());
		Assert.Multiple(() =>
		{
			Assert.That((width, height), Is.EqualTo((200, 200)));
			Assert.That(bitmap.GetPixel(0, 0).Alpha, Is.EqualTo(255));
			Assert.That(bitmap.GetPixel(199, 199).Alpha, Is.EqualTo(255));
			Assert.That(bitmap.GetPixel(0, 0).Red, Is.LessThan(10));
			Assert.That(bitmap.GetPixel(199, 199).Red, Is.GreaterThan(245));
			Assert.That(bitmap.GetPixel(100, 100).Red, Is.InRange(100, 155));
			Assert.That(bitmap.GetPixel(85, 100).Red, Is.InRange(35, 85), "edge should be blurred");
		});
	}

	[Test]
	public void ToPng_AppliesExifOrientation()
	{
		var jpeg = TestImages.Jpeg(40, 20, (x, _) => x < 20 ? Red : Blue, exifOrientation: 6);

		var (output, width, height) = ImageProcessor.ToPng(new MemoryStream(jpeg), null, false);

		using var bitmap = TestImages.Decode(output.ToArray());
		Assert.Multiple(() =>
		{
			Assert.That((width, height), Is.EqualTo((20, 40)));
			Assert.That(bitmap.GetPixel(10, 5).Red, Is.GreaterThan(200), "stored left half is displayed at the top");
			Assert.That(bitmap.GetPixel(10, 34).Blue, Is.GreaterThan(200), "stored right half is displayed at the bottom");
		});
	}

	[Test]
	public void Identify_WithNonImage_Throws()
	{
		var ex = Assert.Throws<InvalidOperationException>(() => ImageProcessor.Identify(new MemoryStream("not an image"u8.ToArray())));

		Assert.That(ex!.Message, Is.EqualTo("Images must be PNG, JPEG, GIF, WebP or BMP"));
	}

	[Test]
	public void Identify_WithUnsupportedFormat_Throws()
	{
		// WBMP decodes in Skia but isn't one of the accepted upload formats
		byte[] wbmp = [0x00, 0x00, 0x08, 0x08, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00];

		var ex = Assert.Throws<InvalidOperationException>(() => ImageProcessor.Identify(new MemoryStream(wbmp)));

		Assert.That(ex!.Message, Is.EqualTo("Images must be PNG, JPEG, GIF, WebP or BMP"));
	}

	[Test]
	public void Identify_WithTooManyPixels_ThrowsBeforeDecoding()
	{
		var png = TestImages.PngHeaderOnly(8000, 6000);

		var ex = Assert.Throws<InvalidOperationException>(() => ImageProcessor.Identify(new MemoryStream(png)));

		Assert.That(ex!.Message, Is.EqualTo("Images must be 40 megapixels or smaller"));
	}

	[Test]
	public void ToPng_WithTooManyPixels_Throws()
	{
		var png = TestImages.PngHeaderOnly(8000, 6000);

		Assert.Throws<InvalidOperationException>(() => ImageProcessor.ToPng(new MemoryStream(png), 512, false));
	}
}
