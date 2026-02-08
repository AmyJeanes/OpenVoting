import type { AssetUploadResponse, PollEntryResponse, PollResponse } from '../../types';

export type PreviewSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) {
    if (poll.isAdmin && entry.submittedByDisplayName) return `From ${entry.submittedByDisplayName}`;
    return '';
  }
  if (hasCustomTitle) return entry.displayName;
  return entry.submittedByDisplayName ? `By ${entry.submittedByDisplayName}` : 'Untitled entry';
}

export function PreviewSection({ poll, entries, assetCache, entryAssetId }: PreviewSectionProps) {
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
                  <p className="entry-title">{entryTitle(poll, e)}</p>
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
