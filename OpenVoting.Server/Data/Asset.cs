namespace OpenVoting.Data;

public sealed class Asset
{
  public Guid Id { get; set; }

  public string StorageKey { get; set; } = string.Empty;
  public string ContentType { get; set; } = "application/octet-stream";
  public long Bytes { get; set; }

  public int? Width { get; set; }
  public int? Height { get; set; }

  public string Sha256 { get; set; } = string.Empty;

  public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
