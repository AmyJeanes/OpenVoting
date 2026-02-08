import type { AssetUploadResponse, PollEntryResponse, PollResponse, VotingBreakdownEntry } from '../../types';

export type AdminEntriesSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
  entriesLoading: boolean;
  votingBreakdown: VotingBreakdownEntry[];
  votingBreakdownError: string | null;
  breakdownByEntryId: Map<string, VotingBreakdownEntry>;
  assetCache: Record<string, AssetUploadResponse>;
  entryAssetId: (entry: { publicAssetId?: string; originalAssetId?: string; teaserAssetId?: string }) => string;
  onRefreshEntries: () => void;
  onRefreshBreakdown: () => void;
  onAskDisqualify: (entryId: string) => void;
  onRequalify: (entryId: string) => void;
  onAskDelete: (entryId: string) => void;
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) {
    return entry.submittedByDisplayName ? `From ${entry.submittedByDisplayName}` : 'From participant';
  }
  if (hasCustomTitle) return entry.displayName;
  return entry.submittedByDisplayName ? `By ${entry.submittedByDisplayName}` : 'Untitled entry';
}

export function AdminEntriesSection(props: AdminEntriesSectionProps) {
  const {
    poll,
    entries,
    entriesLoading,
    votingBreakdown,
    votingBreakdownError,
    breakdownByEntryId,
    assetCache,
    entryAssetId,
    onRefreshEntries,
    onRefreshBreakdown,
    onAskDisqualify,
    onRequalify,
    onAskDelete
  } = props;

  const showAdminBreakdown = poll.isAdmin && poll.status === 2;

  return (
    <section className="card admin-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Entries</p>
          <h3>Admin view</h3>
          <p className="muted">Only admins see unblurred entries before results are public.</p>
        </div>
        <div className="actions">
          <span className="pill">Admin</span>
          <button className="ghost" onClick={onRefreshEntries}>Refresh entries</button>
          {showAdminBreakdown && <button className="ghost" onClick={onRefreshBreakdown}>Refresh tallies</button>}
        </div>
      </div>
      {entriesLoading && <p className="muted">Loading entries…</p>}
      {!entriesLoading && entries.length === 0 && <p className="muted">No entries are visible yet.</p>}
      {showAdminBreakdown && !entriesLoading && entries.length > 0 && votingBreakdown.length === 0 && !votingBreakdownError && (
        <p className="muted">No votes recorded yet.</p>
      )}
      {!entriesLoading && entries.length > 0 && (
        <ul className="entries entry-grid">
          {entries.map((e) => {
            const breakdown = breakdownByEntryId.get(e.id);
            const assetId = entryAssetId(e);
            const asset = assetCache[assetId];
            const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
            return (
              <li key={e.id} className="entry-card">
                <div className="entry-head">
                  <div>
                    <p className="entry-title">{entryTitle(poll, e)}</p>
                    {e.description && <p className="muted">{e.description}</p>}
                    {e.submittedByDisplayName && poll.titleRequirement !== 0 && <p className="muted">By {e.submittedByDisplayName}</p>}
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
                {showAdminBreakdown && !votingBreakdownError && (
                  <div className="muted">
                    {breakdown ? (
                      <>
                        <p>Approvals: {breakdown.approvals}</p>
                        {breakdown.rankCounts.length > 0 && (
                          <div className="pill-row">
                            {breakdown.rankCounts.map((r) => (
                              <span key={r.rank} className="pill compact subtle">Rank {r.rank}: {r.votes}</span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p>No votes yet.</p>
                    )}
                  </div>
                )}

                {poll.isAdmin && (
                  <div className="actions">
                    {e.isDisqualified ? (
                      <button className="ghost" onClick={() => onRequalify(e.id)}>Requalify</button>
                    ) : (
                      <button className="ghost" onClick={() => onAskDisqualify(e.id)}>Disqualify</button>
                    )}
                    <button className="ghost" onClick={() => onAskDelete(e.id)}>Delete</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
