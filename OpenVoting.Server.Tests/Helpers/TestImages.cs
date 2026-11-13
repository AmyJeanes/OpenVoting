using System.Buffers.Binary;
using SkiaSharp;

namespace OpenVoting.Server.Tests.Helpers;

internal static class TestImages
{
	public static byte[] Png(int width, int height, Func<int, int, SKColor> pixel)
	{
		return Encode(width, height, pixel, SKEncodedImageFormat.Png, 100);
	}

	public static byte[] Jpeg(int width, int height, Func<int, int, SKColor> pixel, ushort? exifOrientation = null)
	{
		var jpeg = Encode(width, height, pixel, SKEncodedImageFormat.Jpeg, 100);
		return exifOrientation is ushort orientation ? WithExifOrientation(jpeg, orientation) : jpeg;
	}

	// The fixture the ImageSharp-era blurhashes in the tests were computed from
	public static SKColor Gradient(int x, int y, int width, int height)
	{
		return new SKColor(
			(byte)(x * 255 / (width - 1)),
			(byte)(y * 255 / (height - 1)),
			(byte)((x * 8 / width + y * 6 / height) % 2 * 200 + 30));
	}

	public static SKBitmap Decode(byte[] bytes)
	{
		return SKBitmap.Decode(bytes) ?? throw new InvalidOperationException("Test image did not decode");
	}

	// A PNG whose header declares the given size, with no real pixel data behind it
	public static byte[] PngHeaderOnly(int width, int height)
	{
		var ihdr = new byte[13];
		BinaryPrimitives.WriteInt32BigEndian(ihdr, width);
		BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(4), height);
		ihdr[8] = 8;
		ihdr[9] = 6;

		using var ms = new MemoryStream();
		ms.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
		WriteChunk(ms, "IHDR", ihdr);
		WriteChunk(ms, "IDAT", [0x78, 0x9C, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
		WriteChunk(ms, "IEND", []);
		return ms.ToArray();
	}

	private static byte[] Encode(int width, int height, Func<int, int, SKColor> pixel, SKEncodedImageFormat format, int quality)
	{
		using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Unpremul));
		var pixels = bitmap.GetPixelSpan();
		for (var y = 0; y < height; y++)
		{
			for (var x = 0; x < width; x++)
			{
				var color = pixel(x, y);
				var i = y * bitmap.RowBytes + x * 4;
				pixels[i] = color.Red;
				pixels[i + 1] = color.Green;
				pixels[i + 2] = color.Blue;
				pixels[i + 3] = color.Alpha;
			}
		}

		using var data = bitmap.Encode(format, quality);
		return data.ToArray();
	}

	private static byte[] WithExifOrientation(byte[] jpeg, ushort orientation)
	{
		// Little-endian TIFF header with a single IFD entry: Orientation (0x0112), SHORT, count 1
		byte[] tiff =
		[
			(byte)'I', (byte)'I', 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
			0x01, 0x00,
			0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, (byte)orientation, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00
		];
		byte[] payload = [.. "Exif\0\0"u8, .. tiff];
		var length = payload.Length + 2;
		byte[] app1 = [0xFF, 0xE1, (byte)(length >> 8), (byte)length, .. payload];
		return [.. jpeg.AsSpan(0, 2), .. app1, .. jpeg.AsSpan(2)];
	}

	private static void WriteChunk(Stream stream, string type, byte[] data)
	{
		byte[] typeAndData = [.. System.Text.Encoding.ASCII.GetBytes(type), .. data];
		var buffer = new byte[4];
		BinaryPrimitives.WriteInt32BigEndian(buffer, data.Length);
		stream.Write(buffer);
		stream.Write(typeAndData);
		BinaryPrimitives.WriteUInt32BigEndian(buffer, Crc32(typeAndData));
		stream.Write(buffer);
	}

	private static uint Crc32(ReadOnlySpan<byte> bytes)
	{
		var crc = 0xFFFFFFFFu;
		foreach (var b in bytes)
		{
			crc ^= b;
			for (var k = 0; k < 8; k++)
			{
				crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
			}
		}

		return ~crc;
	}
}
