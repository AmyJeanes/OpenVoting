import type { AssetUploadResponse, PollEntryResponse } from '../../types';

export type PreviewSectionProps = {
  entries: PollEntryResponse[];
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
};

export function PreviewSection({ entries, assetCache, entryAssetId }: PreviewSectionProps) {
  return (
    <section className="card">
      <div className="section-head">
        <h3>Entries (preview)</h3>
        <p className="muted">Images stay blurred until voting opens.</p>
      </div>
      <ul className="entries entry-grid">
        {entries.map((e) => {
          const assetId = entryAssetId(e);
          const asset = assetCache[assetId];
          return (
            <li key={e.id} className="entry-card">
              <div className="entry-head">
                <div>
                  <p className="entry-title">{e.displayName}</p>
                </div>
              </div>
              {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
              {e.description && <p className="muted">{e.description}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
