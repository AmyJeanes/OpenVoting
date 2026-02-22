import { Blurhash } from 'react-blurhash';
import type { PollEntryResponse, PollResponse } from '../../types';

export type PreviewSectionProps = {
  poll: PollResponse;
  entries: PollEntryResponse[];
};

function entryTitle(poll: PollResponse, entry: PollEntryResponse) {
  const hasCustomTitle = (entry.displayName || '').trim().length > 0;
  if (poll.titleRequirement === 0) {
    return '';
  }
  if (hasCustomTitle) return entry.displayName;
  return 'Untitled entry';
}

export function PreviewSection({ poll, entries }: PreviewSectionProps) {
  return (
    <section className="card">
      <div className="section-head">
        <h3>Entries (preview)</h3>
        <p className="muted">Images stay blurred until voting opens</p>
      </div>
      <ul className="entries entry-grid">
        {entries.map((e) => {
          const title = entryTitle(poll, e);
          return (
            <li key={e.id} className="entry-card">
              <div className="entry-head">
                <div>
                  <p className="entry-title">{title}</p>
                </div>
              </div>
              {e.teaserBlurHash ? (
                <div className="entry-img blurhash-preview" aria-label={`${title || 'Entry'} blurred preview`}>
                  <Blurhash hash={e.teaserBlurHash} width="100%" height="100%" resolutionX={32} resolutionY={32} punch={1} />
                </div>
              ) : (
                <div className="entry-img blurhash-preview-fallback" aria-hidden="true" />
              )}
              {e.description && <p className="muted">{e.description}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
