import type { AssetUploadResponse, PollEntryResponse } from '../../types';

export type MySubmissionsSectionProps = {
  entries: PollEntryResponse[];
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
  onAskDelete: (entryId: string) => void;
};

export function MySubmissionsSection({ entries, assetCache, entryAssetId, onAskDelete }: MySubmissionsSectionProps) {
  return (
    <section className="card">
      <div className="section-head">
        <h3>Your submissions</h3>
        <p className="muted">Visible to you; others remain hidden until voting if configured.</p>
      </div>
      <ul className="entries entry-grid">
        {entries.map((e) => {
          const assetId = e.originalAssetId || entryAssetId(e);
          const asset = assetCache[assetId];
          const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
          const hasTitle = (e.displayName || '').trim().length > 0;
          const titleText = hasTitle
            ? e.displayName
            : (e.submittedByDisplayName ? `By ${e.submittedByDisplayName}` : 'Untitled entry');
          return (
            <li key={e.id} className="entry-card">
              <div className="entry-head">
                <div>
                  <p className="entry-title">{titleText}</p>
                  {e.description && <p className="muted">{e.description}</p>}
                </div>
              </div>
              {asset?.url && (
                <a
                  href={originalUrl || asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View full original image"
                >
                  <img src={asset.url} alt={e.displayName} className="entry-img" style={{ cursor: 'zoom-in' }} />
                </a>
              )}
              {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
              <div className="actions">
                <button className="ghost" onClick={() => onAskDelete(e.id)}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
