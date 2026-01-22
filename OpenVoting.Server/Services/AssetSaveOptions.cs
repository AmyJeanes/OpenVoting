namespace OpenVoting.Server.Services;

public sealed class AssetSaveOptions
{
	public bool RequireSquare { get; init; }
	public int? MinDimension { get; init; }
	public int? ResizeTo { get; init; }
	public bool ApplyBlur { get; init; }
	public long? MaxBytes { get; init; }
	public bool NormalizeToPng { get; init; }
}
