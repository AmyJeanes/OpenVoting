using Blurhash;
using SkiaSharp;

namespace OpenVoting.Server.Services;

public static class ImageProcessor
{
	// Keeps a decoded RGBA bitmap to about 160 MB
	public const int MaxPixels = 40_000_000;

	private const float BlurSigma = 20f;
	private const string UnsupportedFormatMessage = "Images must be PNG, JPEG, GIF, WebP or BMP";

	private static readonly SKEncodedImageFormat[] SupportedFormats =
	[
		SKEncodedImageFormat.Png,
		SKEncodedImageFormat.Jpeg,
		SKEncodedImageFormat.Gif,
		SKEncodedImageFormat.Webp,
		SKEncodedImageFormat.Bmp
	];

	private static readonly double[] SRgbToLinear = Enumerable.Range(0, 256).Select(MathUtils.SRgbToLinear).ToArray();

	public static (int Width, int Height) Identify(Stream stream)
	{
		using var data = ReadData(stream);
		using var codec = OpenCodec(data);
		return OrientedSize(codec.EncodedOrigin, codec.Info.Width, codec.Info.Height);
	}

	public static (MemoryStream Png, int Width, int Height) ToPng(Stream stream, int? resizeTo, bool blur)
	{
		using var data = ReadData(stream);
		using var codec = OpenCodec(data);

		// Keeps the source colour space so the PNG carries the same ICC profile rather than converted pixels
		var alphaType = codec.Info.AlphaType == SKAlphaType.Opaque ? SKAlphaType.Opaque : SKAlphaType.Premul;
		var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, alphaType, codec.Info.ColorSpace);
		using var decoded = Decode(codec, info);
		using var oriented = codec.EncodedOrigin == SKEncodedOrigin.TopLeft ? null : ApplyOrigin(decoded, codec.EncodedOrigin);
		var source = oriented ?? decoded;
		source.SetImmutable();

		var image = SKImage.FromBitmap(source);
		try
		{
			if (resizeTo is int size)
			{
				Replace(ref image, CropAndResize(image, size));
			}

			if (blur)
			{
				Replace(ref image, Blur(image));
			}

			using var png = image.Encode(SKEncodedImageFormat.Png, 100) ?? throw new InvalidOperationException("Unable to encode image");
			var buffer = new MemoryStream();
			png.SaveTo(buffer);
			buffer.Position = 0;
			return (buffer, image.Width, image.Height);
		}
		finally
		{
			image.Dispose();
		}
	}

	public static string CreateBlurHash(Stream stream, int componentsX, int componentsY)
	{
		using var data = ReadData(stream);
		using var codec = OpenCodec(data);

		// No target colour space: hashes use the decoded bytes without colour management, as existing hashes did
		var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Unpremul);
		using var bitmap = Decode(codec, info);

		var origin = codec.EncodedOrigin;
		var (width, height) = OrientedSize(origin, bitmap.Width, bitmap.Height);
		var encoder = new StreamedEncoder(componentsX, componentsY, width, height);

		var pixels = bitmap.GetPixelSpan();
		var row = new StreamedPixel[bitmap.Width];
		for (var y = 0; y < bitmap.Height; y++)
		{
			var rowStart = y * bitmap.RowBytes;
			for (var x = 0; x < bitmap.Width; x++)
			{
				var i = rowStart + x * 4;
				var (orientedX, orientedY) = Orient(origin, x, y, bitmap.Width, bitmap.Height);
				row[x] = new StreamedPixel(SRgbToLinear[pixels[i]], SRgbToLinear[pixels[i + 1]], SRgbToLinear[pixels[i + 2]], orientedX, orientedY);
			}

			encoder.Process(row);
		}

		return encoder.Finish();
	}

	private static SKData ReadData(Stream stream)
	{
		if (!stream.CanSeek)
		{
			throw new InvalidOperationException("Image stream must be seekable");
		}

		stream.Position = 0;
		var data = SKData.Create(stream);
		stream.Position = 0;
		return data ?? throw new InvalidOperationException(UnsupportedFormatMessage);
	}

	private static SKCodec OpenCodec(SKData data)
	{
		var codec = SKCodec.Create(data);
		if (codec is null || !SupportedFormats.Contains(codec.EncodedFormat))
		{
			codec?.Dispose();
			throw new InvalidOperationException(UnsupportedFormatMessage);
		}

		// Checked from the header before any pixels are allocated
		if ((long)codec.Info.Width * codec.Info.Height > MaxPixels)
		{
			codec.Dispose();
			throw new InvalidOperationException($"Images must be {MaxPixels / 1_000_000} megapixels or smaller");
		}

		return codec;
	}

	private static SKBitmap Decode(SKCodec codec, SKImageInfo info)
	{
		return SKBitmap.Decode(codec, info) ?? throw new InvalidOperationException("Invalid image file");
	}

	private static (int Width, int Height) OrientedSize(SKEncodedOrigin origin, int width, int height)
	{
		return origin >= SKEncodedOrigin.LeftTop ? (height, width) : (width, height);
	}

	// Maps a stored pixel to where the EXIF orientation displays it
	private static (int X, int Y) Orient(SKEncodedOrigin origin, int x, int y, int width, int height)
	{
		return origin switch
		{
			SKEncodedOrigin.TopRight => (width - 1 - x, y),
			SKEncodedOrigin.BottomRight => (width - 1 - x, height - 1 - y),
			SKEncodedOrigin.BottomLeft => (x, height - 1 - y),
			SKEncodedOrigin.LeftTop => (y, x),
			SKEncodedOrigin.RightTop => (height - 1 - y, x),
			SKEncodedOrigin.RightBottom => (height - 1 - y, width - 1 - x),
			SKEncodedOrigin.LeftBottom => (y, width - 1 - x),
			_ => (x, y)
		};
	}

	private static SKBitmap ApplyOrigin(SKBitmap source, SKEncodedOrigin origin)
	{
		var (width, height) = OrientedSize(origin, source.Width, source.Height);
		var oriented = new SKBitmap(source.Info.WithSize(width, height));
		var sourcePixels = source.GetPixelSpan();
		var orientedPixels = oriented.GetPixelSpan();
		for (var y = 0; y < source.Height; y++)
		{
			for (var x = 0; x < source.Width; x++)
			{
				var (orientedX, orientedY) = Orient(origin, x, y, source.Width, source.Height);
				sourcePixels.Slice(y * source.RowBytes + x * 4, 4).CopyTo(orientedPixels.Slice(orientedY * oriented.RowBytes + orientedX * 4, 4));
			}
		}

		return oriented;
	}

	private static SKImage CropAndResize(SKImage image, int size)
	{
		var side = Math.Min(image.Width, image.Height);
		var current = image.Subset(SKRectI.Create((image.Width - side) / 2, (image.Height - side) / 2, side, side));

		// A single cubic pass skips source pixels on large downscales and aliases, so halve with bilinear first
		while (current.Width / 2 >= size)
		{
			Replace(ref current, Draw(current, current.Width / 2, new SKSamplingOptions(SKFilterMode.Linear)));
		}

		var resized = Draw(current, size, new SKSamplingOptions(SKCubicResampler.CatmullRom));
		current.Dispose();
		return resized;
	}

	private static SKImage Draw(SKImage source, int size, SKSamplingOptions sampling)
	{
		using var surface = SKSurface.Create(source.Info.WithSize(size, size)) ?? throw new InvalidOperationException("Unable to resize image");
		surface.Canvas.DrawImage(source, SKRect.Create(source.Width, source.Height), SKRect.Create(size, size), sampling, null);
		return surface.Snapshot();
	}

	private static SKImage Blur(SKImage image)
	{
		// Clamp repeats the edge pixels, so the borders don't fade towards transparent black
		using var filter = SKImageFilter.CreateBlur(BlurSigma, BlurSigma, SKShaderTileMode.Clamp);
		var bounds = SKRectI.Create(image.Width, image.Height);
		using var filtered = image.ApplyImageFilter(filter, bounds, bounds, out var subset, out SKPointI _) ?? throw new InvalidOperationException("Unable to blur image");
		return filtered.Subset(subset);
	}

	private static void Replace(ref SKImage image, SKImage next)
	{
		image.Dispose();
		image = next;
	}
}
