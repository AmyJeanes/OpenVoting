import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { ConfirmDialog, type ConfirmDialogConfig } from './ConfirmDialog';
import { VotingMethodInfo } from './VotingMethodInfo';
import type {
  AssetUploadResponse,
  PollEntryResponse,
  PollDetailResponse,
  PollResponse,
  SessionState,
  VoteResponse,
  VotingBreakdownEntry
} from '../types';
import { formatWindow, fromLocal, isMaxTimestamp, pollStatusLabel, toLocal, votingMethodLabel } from '../utils/format';

export type CurrentPollProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  poll: PollResponse | null;
  pollDetail: PollDetailResponse | null;
  pollError: string | null;
  entries: PollEntryResponse[];
  entriesError: string | null;
  entriesLoading: boolean;
  voteState: Record<string, { selected: boolean; rank: string }>;
  voteError: string | null;
  voteSubmitting: boolean;
  voteInfo: VoteResponse | null;
  votingBreakdown: VotingBreakdownEntry[];
  votingBreakdownError: string | null;
  entryForm: {
    displayName: string;
    description: string;
  };
  entryFiles: { original?: File };
  entrySubmitError: string | null;
  entrySubmitting: boolean;
  assetCache: Record<string, AssetUploadResponse>;
  onRefreshPoll: () => Promise<void> | void;
  onSelectPoll: (id: string) => void;
  onRefreshEntries: () => Promise<void> | void;
  onToggleSelection: (id: string, selected: boolean) => void;
  onUpdateRank: (id: string, rank: string) => void;
  onSubmitVote: (rankedIds?: string[]) => void;
  onSubmitEntry: () => void;
  onEntryFormChange: (form: CurrentPollProps['entryForm']) => void;
  onEntryFilesChange: (files: CurrentPollProps['entryFiles']) => void;
  onDisqualify: (entryId: string, reason: string) => void;
  onRequalify: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onTransition: (pollId: string, path: string) => void;
  onDeletePoll: (pollId: string) => void;
  onUpdateMetadata: (pollId: string, updates: { title?: string; description?: string }) => Promise<unknown>;
  onUpdateSubmissionSettings: (pollId: string, updates: { maxSubmissionsPerMember?: number; submissionClosesAt?: string | null }) => Promise<unknown>;
  onUpdateVotingSettings: (pollId: string, updates: { maxSelections?: number; votingClosesAt?: string | null }) => Promise<unknown>;
  onRefreshBreakdown: () => Promise<void> | void;
};

export function CurrentPollPage(props: CurrentPollProps) {
  const {
    sessionState,
    poll,
    pollDetail,
    pollError,
    entries,
    entriesError,
    entriesLoading,
    voteState,
    voteError,
    voteSubmitting,
    voteInfo,
    votingBreakdown,
    votingBreakdownError,
    entryForm,
    entryFiles,
    entrySubmitError,
    entrySubmitting,
    assetCache,
    onRefreshPoll,
    onSelectPoll,
    onRefreshEntries,
    onToggleSelection,
    onUpdateRank,
    onSubmitVote,
    onSubmitEntry,
    onEntryFormChange,
    onEntryFilesChange,
    onDisqualify,
    onRequalify,
    onDeleteEntry,
    onTransition,
    onDeletePoll,
    onUpdateMetadata,
    onUpdateSubmissionSettings,
    onUpdateVotingSettings,
    onRefreshBreakdown
  } = props;

  const { pollId } = useParams();
  const isClosed = poll?.status === 3 || poll?.status === 4;
  const hasWinners = isClosed && (pollDetail?.winners?.length ?? 0) > 0;
  const showSubmissionSettings = !!poll && poll.status === 1;
  const showVotingSettings = !!poll && poll.status === 2;
  const showVotingWindow = !!poll && (poll.status === 2 || isClosed) && !isMaxTimestamp(poll.votingOpensAt);
  const showAdminEntries = !!poll && !isClosed && poll.isAdmin;
  const showAdminBreakdown = !!poll && poll.isAdmin && poll.status === 2;
  const showBlurredPreview = !!poll && !poll.isAdmin && poll.hideEntriesUntilVoting && (poll.status === 1 || poll.status === 5) && entries.length > 0;
  const myEntries = useMemo(() => entries.filter((e) => e.isOwn), [entries]);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmDialogConfig | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState('');
  const [pendingAction, setPendingAction] = useState<'disqualify' | 'delete' | null>(null);
  const isRankedMethod = !!poll?.requireRanking;
  const breakdownByEntryId = useMemo(() => {
    const map = new Map<string, VotingBreakdownEntry>();
    votingBreakdown.forEach((b) => map.set(b.entryId, b));
    return map;
  }, [votingBreakdown]);
  const [irvStage, setIrvStage] = useState<'select' | 'rank'>('select');
  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [rankError, setRankError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverAfter, setDragOverAfter] = useState(false);
  const selectedEntries = useMemo(() => entries.filter((e) => voteState[e.id]?.selected), [entries, voteState]);
  const rankedEntries = useMemo(() => rankedIds.map((id) => entries.find((e) => e.id === id)).filter((e): e is PollEntryResponse => !!e), [entries, rankedIds]);
  const preferTeaserAsset = poll?.hideEntriesUntilVoting && !poll?.isAdmin && (poll.status === 1 || poll.status === 5);
  const entryAssetId = (entry: { publicAssetId?: string; originalAssetId: string; teaserAssetId?: string }) => {
    if (preferTeaserAsset && entry.teaserAssetId) {
      return entry.teaserAssetId;
    }
    return entry.publicAssetId ?? entry.originalAssetId ?? entry.teaserAssetId ?? '';
  };
  const [metaForm, setMetaForm] = useState({ title: '', description: '' });
  const [submissionForm, setSubmissionForm] = useState({ maxSubmissionsPerMember: 1, submissionClosesAt: '' });
  const [votingForm, setVotingForm] = useState({ maxSelections: 1, votingClosesAt: '' });
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [metaSaving, setMetaSaving] = useState(false);
  const [submissionSaving, setSubmissionSaving] = useState(false);
  const [votingSaving, setVotingSaving] = useState(false);

  useEffect(() => {
    if (pollId) {
      onSelectPoll(pollId);
    }
  }, [pollId]);

  useEffect(() => {
    if (!poll?.requireRanking) {
      setIrvStage('select');
      setRankedIds([]);
      setRankError(null);
      return;
    }

    const ordered = entries
      .filter((e) => voteState[e.id]?.selected)
      .sort((a, b) => {
        const ra = Number(voteState[a.id]?.rank ?? Number.POSITIVE_INFINITY);
        const rb = Number(voteState[b.id]?.rank ?? Number.POSITIVE_INFINITY);
        if (Number.isNaN(ra) && Number.isNaN(rb)) return 0;
        if (Number.isNaN(ra)) return 1;
        if (Number.isNaN(rb)) return -1;
        if (ra === rb) return 0;
        return ra - rb;
      })
      .map((e) => e.id);

    setIrvStage('select');
    setRankError(null);
    setRankedIds(ordered);
  }, [poll?.id, poll?.requireRanking, voteInfo?.voteId, entries]);

  const handleSaveMeta = async () => {
    if (!poll) return;
    setSettingsError(null);
    setSettingsMessage(null);
    setMetaSaving(true);
    try {
      const updates: { title?: string; description?: string } = {};
      if (metaForm.title !== poll.title) updates.title = metaForm.title;
      if ((metaForm.description || '') !== (poll.description ?? '')) updates.description = metaForm.description;

      if (Object.keys(updates).length === 0) {
        setSettingsMessage('Nothing to update');
        return;
      }

      await onUpdateMetadata(poll.id, updates);
      setSettingsMessage('Poll details updated');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update poll');
    } finally {
      setMetaSaving(false);
    }
  };

  const handleSaveSubmissionSettings = async () => {
    if (!poll) return;
    setSettingsError(null);
    setSettingsMessage(null);
    setSubmissionSaving(true);
    try {
      const updates: { maxSubmissionsPerMember?: number; submissionClosesAt?: string | null } = {};
      const currentClose = isMaxTimestamp(poll.submissionClosesAt) ? '' : toLocal(poll.submissionClosesAt);

      if (submissionForm.maxSubmissionsPerMember !== poll.maxSubmissionsPerMember) {
        updates.maxSubmissionsPerMember = submissionForm.maxSubmissionsPerMember;
      }

      if (submissionForm.submissionClosesAt !== currentClose) {
        updates.submissionClosesAt = submissionForm.submissionClosesAt === '' ? null : fromLocal(submissionForm.submissionClosesAt);
      }

      if (Object.keys(updates).length === 0) {
        setSettingsMessage('Nothing to update');
        return;
      }

      await onUpdateSubmissionSettings(poll.id, updates);
      setSettingsMessage('Submission settings updated');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update submission settings');
    } finally {
      setSubmissionSaving(false);
    }
  };

  const handleSaveVotingSettings = async () => {
    if (!poll) return;
    setSettingsError(null);
    setSettingsMessage(null);
    setVotingSaving(true);
    try {
      const updates: { maxSelections?: number; votingClosesAt?: string | null } = {};
      const currentClose = isMaxTimestamp(poll.votingClosesAt) ? '' : toLocal(poll.votingClosesAt);

      if (votingForm.maxSelections !== poll.maxSelections) {
        updates.maxSelections = votingForm.maxSelections;
      }

      if (votingForm.votingClosesAt !== currentClose) {
        updates.votingClosesAt = votingForm.votingClosesAt === '' ? null : fromLocal(votingForm.votingClosesAt);
      }

      if (Object.keys(updates).length === 0) {
        setSettingsMessage('Nothing to update');
        return;
      }

      await onUpdateVotingSettings(poll.id, updates);
      setSettingsMessage('Voting settings updated');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update voting settings');
    } finally {
      setVotingSaving(false);
    }
  };

  const handleConfirm = () => {
    if (!pendingEntryId || !pendingAction) {
      setConfirmConfig(null);
      return;
    }

    if (pendingAction === 'disqualify') {
      onDisqualify(pendingEntryId, pendingReason);
    }

    if (pendingAction === 'delete') {
      onDeleteEntry(pendingEntryId);
    }

    setConfirmConfig(null);
    setPendingEntryId(null);
    setPendingReason('');
    setPendingAction(null);
  };

  const handleCancelConfirm = () => {
    setConfirmConfig(null);
    setPendingEntryId(null);
    setPendingReason('');
    setPendingAction(null);
  };

  const handleToggleSelection = (entryId: string, selected: boolean) => {
    onToggleSelection(entryId, selected);
    if (!isRankedMethod) return;
    setRankedIds((prev) => {
      if (selected) {
        if (prev.includes(entryId)) return prev;
        return [...prev, entryId];
      }
      return prev.filter((id) => id !== entryId);
    });
    if (!selected) {
      onUpdateRank(entryId, '');
    }
  };

  const handleProceedToRanking = () => {
    if (!poll || !poll.requireRanking) return;
    if (selectedEntries.length === 0) {
      setRankError('Select at least one entry to rank.');
      return;
    }
    if (selectedEntries.length > poll.maxSelections) {
      setRankError(`Select at most ${poll.maxSelections} entries.`);
      return;
    }
    const selectedIds = selectedEntries.map((e) => e.id);
    const ordered = rankedIds.filter((id) => selectedIds.includes(id));
    const remaining = selectedIds.filter((id) => !ordered.includes(id));
    setRankedIds([...ordered, ...remaining]);
    setRankError(null);
    setIrvStage('rank');
  };

  const handleBackToSelection = () => {
    setIrvStage('select');
    setDraggingId(null);
  };

  const handleDragOverItem = (ev: React.DragEvent<HTMLLIElement>, targetId: string) => {
    ev.preventDefault();
    setDragOverId(targetId);
    setDragOverAfter(false);
  };

  const handleDropOnItem = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    setRankedIds((prev) => {
      const fromIdx = prev.indexOf(draggingId);
      const toIdx = prev.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });
    setDraggingId(null);
    setDragOverId(null);
    setDragOverAfter(false);
  };

  const moveRank = (entryId: string, direction: -1 | 1) => {
    setRankedIds((prev) => {
      const idx = prev.indexOf(entryId);
      if (idx === -1) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleRankSubmit = () => {
    if (rankedIds.length === 0) {
      setRankError('Select entries to rank.');
      return;
    }
    onSubmitVote(rankedIds);
  };

  const handleClearSelection = () => {
    entries.forEach((e) => handleToggleSelection(e.id, false));
    setRankedIds([]);
    setRankError(null);
  };

  useEffect(() => {
    if (!poll) return;
    setMetaForm({
      title: poll.title,
      description: poll.description ?? ''
    });
    setSubmissionForm({
      maxSubmissionsPerMember: poll.maxSubmissionsPerMember,
      submissionClosesAt: isMaxTimestamp(poll.submissionClosesAt) ? '' : toLocal(poll.submissionClosesAt)
    });
    setVotingForm({
      maxSelections: poll.maxSelections,
      votingClosesAt: isMaxTimestamp(poll.votingClosesAt) ? '' : toLocal(poll.votingClosesAt)
    });
    setSettingsError(null);
    setSettingsMessage(null);
  }, [poll?.id]);

  const dialogConfig = confirmConfig
    ? {
        ...confirmConfig,
        content:
          pendingAction === 'disqualify'
            ? (
              <label className="stack">
                Reason (optional)
                <textarea
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  rows={3}
                />
              </label>
            )
            : confirmConfig.content
      }
    : null;

  if (sessionState !== 'authenticated') {
    return <AuthPrompt />;
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Poll</p>
            <h2>{poll ? poll.title : 'No active competition'}</h2>
            {poll && <span className={`pill ${poll.status === 0 ? 'admin' : 'subtle'}`}>Stage: {pollStatusLabel(poll.status)}</span>}
            {poll?.description && <p className="muted">{poll.description}</p>}
          </div>
          <div className="actions">
            <Link className="ghost" to="/polls/live">Back to live polls</Link>
            <button className="ghost" onClick={onRefreshPoll}>Refresh</button>
          </div>
        </div>
        {pollError && <p className="error">{pollError}</p>}
        {!poll && <p className="muted">No data for this poll. It may have closed or been removed.</p>}
        {poll && (
          <div className="details-grid">
            <div>
              <p className="muted">Status</p>
              <p className="metric">{pollStatusLabel(poll.status)}</p>
            </div>
            <div>
              <p className="muted">Voting method</p>
              <div className="metric-row">
                <p className="metric">{votingMethodLabel(poll.votingMethod)}</p>
                <VotingMethodInfo method={poll.votingMethod} />
              </div>
            </div>
            <div>
              <p className="muted">Submission window</p>
              <p>{formatWindow(poll.submissionOpensAt, poll.submissionClosesAt)}</p>
            </div>
            {showVotingWindow && (
              <div>
                <p className="muted">Voting window</p>
                <p>{formatWindow(poll.votingOpensAt, poll.votingClosesAt)}</p>
              </div>
            )}
            {poll.mustHaveJoinedBefore && (
              <div>
                <p className="muted">Join cutoff</p>
                <p>{new Date(poll.mustHaveJoinedBefore).toLocaleString()}</p>
              </div>
            )}
            {poll.requiredRoleIds.length > 0 && (
              <div>
                <p className="muted">Required roles</p>
                <p>{poll.requiredRoleIds.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {poll?.isAdmin && (
        <section className="card admin-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Admin</p>
              <h3>Poll controls</h3>
            </div>
            <span className="pill">Admin</span>
          </div>
          <p className="muted">Only admins see this. Use with care.</p>
          <div className="actions admin-actions">
            {poll.status === 0 && <button className="primary" onClick={() => onTransition(poll.id, 'open-submissions')}>Open submissions</button>}
            {poll.status === 1 && <button className="primary" onClick={() => onTransition(poll.id, 'start-review')}>Start review</button>}
            {poll.status === 5 && <button className="primary" onClick={() => onTransition(poll.id, 'open-voting')}>Open voting</button>}
            {poll.status === 2 && <button className="ghost" onClick={() => onTransition(poll.id, 'close')}>Close poll</button>}
            <button className="ghost" onClick={() => onDeletePoll(poll.id)}>Delete poll</button>
          </div>

          {settingsError && <p className="error">{settingsError}</p>}
          {settingsMessage && <p className="muted">{settingsMessage}</p>}

          <div className="stack">
            <div>
              <p className="eyebrow">Basics</p>
              <div className="form-grid">
                <label>Title
                  <input value={metaForm.title} onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })} />
                </label>
                <label>Description
                  <input value={metaForm.description} onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })} />
                </label>
              </div>
              <div className="actions form-actions spacious">
                <button className="ghost" onClick={handleSaveMeta} disabled={metaSaving}>{metaSaving ? 'Saving…' : 'Save basics'}</button>
              </div>
            </div>

            {showSubmissionSettings && (
              <div>
                <p className="eyebrow">Submission stage</p>
                <div className="form-grid">
                  <label>Max submissions per member
                    <input
                      type="number"
                      min={1}
                      value={submissionForm.maxSubmissionsPerMember}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, maxSubmissionsPerMember: Math.max(1, Number(e.target.value)) })}
                    />
                  </label>
                  <label>Auto-close submissions (optional)
                    <input
                      type="datetime-local"
                      value={submissionForm.submissionClosesAt}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, submissionClosesAt: e.target.value })}
                    />
                  </label>
                </div>
                <div className="actions form-actions spacious">
                  <button className="ghost" onClick={handleSaveSubmissionSettings} disabled={submissionSaving}>
                    {submissionSaving ? 'Saving…' : 'Save submission settings'}
                  </button>
                  <span className="muted">Leave blank to close manually.</span>
                </div>
              </div>
            )}

            {showVotingSettings && (
              <div>
                <p className="eyebrow">Voting stage</p>
                <p className="muted">
                  Voting method: {votingMethodLabel(poll.votingMethod)} (locked once voting starts)
                  {' '}<VotingMethodInfo method={poll.votingMethod} />
                </p>
                <div className="form-grid">
                  <label>Max selections
                    <input
                      type="number"
                      min={1}
                      value={votingForm.maxSelections}
                      onChange={(e) => setVotingForm({ ...votingForm, maxSelections: Math.max(1, Number(e.target.value)) })}
                    />
                  </label>
                  <label>Auto-close voting (optional)
                    <input
                      type="datetime-local"
                      value={votingForm.votingClosesAt}
                      onChange={(e) => setVotingForm({ ...votingForm, votingClosesAt: e.target.value })}
                    />
                  </label>
                </div>
                <div className="actions form-actions spacious">
                  <button className="ghost" onClick={handleSaveVotingSettings} disabled={votingSaving}>
                    {votingSaving ? 'Saving…' : 'Save voting settings'}
                  </button>
                  <span className="muted">Leave blank to close manually.</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {hasWinners && pollDetail && (
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Results</p>
              <h3>Winners</h3>
            </div>
          </div>
          <div className="winners">
            {pollDetail.winners.map((w) => (
              <div key={w.entryId} className="winner-chip">
                <div>
                  <strong>{w.displayName}</strong>
                  <span className="muted"> · {w.votes} vote{w.votes === 1 ? '' : 's'}</span>
                </div>
                {w.assetId && assetCache[w.assetId]?.url && (
                  <img src={assetCache[w.assetId]!.url} alt={w.displayName} className="winner-img" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showAdminEntries && (
        <section className="card admin-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Entries</p>
              <h3>Admin view</h3>
              <p className="muted">Only admins see entries before results are public. Tallies show during voting.</p>
            </div>
            <div className="actions">
              <span className="pill">Admin</span>
              <button className="ghost" onClick={onRefreshEntries}>Refresh entries</button>
              {showAdminBreakdown && <button className="ghost" onClick={onRefreshBreakdown}>Refresh tallies</button>}
            </div>
          </div>
          {showAdminBreakdown && votingBreakdownError && <p className="error">{votingBreakdownError}</p>}
          {entriesError && <p className="error">{entriesError}</p>}
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
                return (
                  <li key={e.id} className="entry-card">
                    <div className="entry-head">
                      <div>
                        <p className="entry-title">{e.displayName}</p>
                        {e.description && <p className="muted">{e.description}</p>}
                        {e.submittedByDisplayName && <p className="muted">By {e.submittedByDisplayName}</p>}
                      </div>
                    </div>
                    {asset?.url && (
                      <img
                        src={asset.url}
                        alt={e.displayName}
                        className="entry-img"
                      />
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
                          <button className="ghost" onClick={() => {
                            setPendingEntryId(e.id);
                            setPendingReason('');
                            setPendingAction('disqualify');
                            setConfirmConfig({
                              title: 'Disqualify entry?',
                              body: 'Provide a reason. This hides the entry from voting tallies.',
                              confirmLabel: 'Disqualify',
                              cancelLabel: 'Cancel',
                              tone: 'danger'
                            });
                          }}>Disqualify</button>
                        )}
                        <button className="ghost" onClick={() => {
                          setPendingEntryId(e.id);
                          setPendingAction('delete');
                          setConfirmConfig({
                            title: 'Delete entry?',
                            body: 'This removes the entry and any uploaded assets.',
                            confirmLabel: 'Delete',
                            cancelLabel: 'Cancel',
                            tone: 'danger'
                          });
                        }}>Delete</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {poll?.canSubmit && !isClosed && (
        <section className="card">
          <div className="section-head">
            <h3>Submit an entry</h3>
          </div>
          <div className="form-grid">
            <label>Display name
              <input value={entryForm.displayName} onChange={(e) => onEntryFormChange({ ...entryForm, displayName: e.target.value })} />
            </label>
            <label>Description
              <input value={entryForm.description} onChange={(e) => onEntryFormChange({ ...entryForm, description: e.target.value })} />
            </label>
            <label>Upload image
              <input type="file" accept="image/*" onChange={(e) => onEntryFilesChange({ ...entryFiles, original: e.target.files?.[0] ?? undefined })} />
            </label>
          </div>
          {entrySubmitError && <p className="error">{entrySubmitError}</p>}
          <div className="actions form-actions">
            <button className="primary" onClick={onSubmitEntry} disabled={entrySubmitting}>{entrySubmitting ? 'Submitting…' : 'Submit entry'}</button>
          </div>
        </section>
      )}

      {poll?.status === 1 && myEntries.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h3>Your submissions</h3>
            <p className="muted">Visible to you; others remain hidden until voting if configured.</p>
          </div>
          <ul className="entries entry-grid">
            {myEntries.map((e) => {
		      const assetId = entryAssetId(e);
		      const asset = assetCache[assetId];
              return (
                <li key={e.id} className="entry-card">
                  <div className="entry-head">
                    <div>
                      <p className="entry-title">{e.displayName}</p>
                      {e.description && <p className="muted">{e.description}</p>}
                      <p className="muted">Submitted {new Date(e.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="badges">
                      {e.submittedByDisplayName && <span className="pill subtle">By {e.submittedByDisplayName}</span>}
                    </div>
                  </div>
                  {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
                  {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
                  <div className="actions">
                    <button className="ghost" onClick={() => {
                      setPendingEntryId(e.id);
                      setPendingAction('delete');
                      setConfirmConfig({
                        title: 'Delete your entry?',
                        body: 'This removes the entry and any uploaded assets.',
                        confirmLabel: 'Delete',
                        cancelLabel: 'Cancel',
                        tone: 'danger'
                      });
                    }}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showBlurredPreview && (
        <section className="card">
          <div className="section-head">
            <h3>Entries (preview)</h3>
            <p className="muted">Images stay blurred until voting opens.</p>
          </div>
          <div className="vote-grid">
            {entries.map((e) => {
              const assetId = entryAssetId(e);
              const asset = assetCache[assetId];
              return (
                <div key={e.id} className="entry-card vote-card">
                  <div className="vote-head">
                    <span className="entry-title">{e.displayName}</span>
                    {e.submittedByDisplayName && <span className="muted">By {e.submittedByDisplayName}</span>}
                  </div>
                  {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
                  {e.description && <p className="muted">{e.description}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {poll?.canVote && !isClosed && entries.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h3>{isRankedMethod ? 'Vote — Step 1: select entries' : 'Vote'}</h3>
            <p className="muted">
              {isRankedMethod
                ? `Pick up to ${poll.maxSelections} entries to rank. Drag to order them in the next step.`
                : `Select up to ${poll.maxSelections} entries.`}
            </p>
          </div>
          {rankError && <p className="error">{rankError}</p>}
          {!isRankedMethod && voteError && <p className="error">{voteError}</p>}
          <div className="vote-grid">
            {entries.map((e) => {
              const current = voteState[e.id] ?? { selected: false, rank: '' };
		      const assetId = entryAssetId(e);
		      const asset = assetCache[assetId];
              const isSelected = current.selected;
              return (
                <div
                  key={e.id}
                  className={`entry-card vote-card ${isSelected ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleSelection(e.id, !isSelected)}
                  onKeyDown={(ev) => {
                    if (ev.key === ' ' || ev.key === 'Enter') {
                      ev.preventDefault();
                      handleToggleSelection(e.id, !isSelected);
                    }
                  }}
                >
                  <div className="vote-head">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => handleToggleSelection(e.id, ev.target.checked)}
                      />
                      <span className="entry-title">{e.displayName}</span>
                    </label>
                    {e.submittedByDisplayName && <span className="muted">By {e.submittedByDisplayName}</span>}
                  </div>
                  {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
                  {e.description && <p className="muted">{e.description}</p>}
                  {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
                  {isRankedMethod && isSelected && <p className="muted">Ranking happens in the next step.</p>}
                </div>
              );
            })}
          </div>
          <div className="actions">
            {isRankedMethod ? (
              <>
                <button className="primary" onClick={handleProceedToRanking} disabled={voteSubmitting}>
                  Continue to ranking
                </button>
                <button className="ghost" onClick={handleClearSelection} disabled={voteSubmitting}>Clear selection</button>
              </>
            ) : (
              <button className="primary" onClick={() => onSubmitVote()} disabled={voteSubmitting}>
                {voteSubmitting ? 'Submitting…' : 'Submit vote'}
              </button>
            )}
          </div>
          {voteInfo && (
            <p className="muted">Last submitted: {voteInfo.submittedAt ? new Date(voteInfo.submittedAt).toLocaleString() : 'Pending'}</p>
          )}
        </section>
      )}

      {poll?.canVote && !isClosed && poll.requireRanking && irvStage === 'rank' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && handleBackToSelection()}>
          <div className="modal-card wide">
            <p className="eyebrow">Vote — Step 2</p>
            <h3>Order your selections</h3>
            <p className="muted">Drag to reorder. Top item becomes rank 1.</p>
            {voteError && <p className="error">{voteError}</p>}
            {rankError && <p className="error">{rankError}</p>}
            {rankedEntries.length === 0 && <p className="muted">No selections yet.</p>}
            {rankedEntries.length > 0 && (
              <ul className="rank-list">
                {rankedEntries.map((e, idx) => (
                  <li
                    key={e.id}
                    className={`rank-item${draggingId === e.id ? ' dragging' : ''}${dragOverId === e.id ? ' drop-target' : ''}${dragOverId === e.id && dragOverAfter ? ' drop-after' : ''}`}
                    draggable
                    onDragStart={() => setDraggingId(e.id)}
                    onDragOver={(ev) => handleDragOverItem(ev, e.id)}
                    onDrop={() => handleDropOnItem(e.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                      setDragOverAfter(false);
                    }}
                  >
                    <div className="rank-controls">
                      <span className="drag-handle" aria-hidden="true">↕</span>
                      <div className="rank-actions">
                        <button
                          className="ghost"
                          onClick={() => moveRank(e.id, -1)}
                          aria-label={`Move ${e.displayName} up`}
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                        <button
                          className="ghost"
                          onClick={() => moveRank(e.id, 1)}
                          aria-label={`Move ${e.displayName} down`}
                          disabled={idx === rankedEntries.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    <div className="rank-body">
                      <div className="rank-title">#{idx + 1} · {e.displayName}</div>
                      {e.submittedByDisplayName && <p className="muted">By {e.submittedByDisplayName}</p>}
                    </div>
                    {assetCache[entryAssetId(e)]?.url && (
                      <img
                        src={assetCache[entryAssetId(e)]!.url}
                        alt={e.displayName}
                        className="rank-img"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button className="ghost" onClick={handleBackToSelection} disabled={voteSubmitting}>Back to selection</button>
              <button className="primary" onClick={handleRankSubmit} disabled={voteSubmitting}>
                {voteSubmitting ? 'Submitting…' : 'Submit ranked vote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isClosed && pollDetail && (
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Entries</p>
              <h3>Full breakdown</h3>
            </div>
          </div>
          {pollDetail.entries.length === 0 && <p className="muted">No entries recorded.</p>}
          {pollDetail.entries.length > 0 && (
            <ul className="entries">
              {pollDetail.entries.map((e) => {
		      const assetId = entryAssetId(e);
		      const asset = assetCache[assetId];
                const firstChoice = pollDetail.votingMethod === 2 ? e.rankCounts.find((r) => r.rank === 1)?.votes ?? 0 : undefined;
                return (
                  <li key={e.id} className="entry-card">
                    <div className="entry-head">
                      <div>
                        <p className="entry-title">{e.displayName}</p>
                        <p className="muted">Submitted {new Date(e.createdAt).toLocaleString()}</p>
                        {e.submittedByDisplayName && <p className="muted">By {e.submittedByDisplayName}</p>}
                        {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
                      </div>
                      <div className="badges">
                        {typeof e.position === 'number' && <span className="pill subtle">#{e.position}</span>}
                      {e.isWinner && <span className="pill">Winner</span>}
                      </div>
                    </div>
                    {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
                    {e.description && <p className="muted">{e.description}</p>}
                    <div className="actions">
                      {pollDetail.votingMethod === 2 ? (
                        <span className="pill subtle">{firstChoice} first-choice</span>
                      ) : (
                        <span className="pill subtle">{e.approvalVotes} approvals</span>
                      )}
                    </div>
                    {pollDetail.votingMethod === 2 && e.rankCounts.length > 0 && (
                      <div className="muted">
                        {e.rankCounts.map((r) => (
                          <span key={r.rank} className="pill subtle">Rank {r.rank}: {r.votes}</span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <ConfirmDialog config={dialogConfig} onConfirm={handleConfirm} onCancel={handleCancelConfirm} />
    </div>
  );
}
