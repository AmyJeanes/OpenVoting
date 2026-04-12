import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AuthPrompt } from './AuthPrompt';
import { ConfirmDialog, type ConfirmDialogConfig } from './ConfirmDialog';
import { ImageLightbox, type ImageLightboxData } from './ImageLightbox';
import { MarkdownText } from './MarkdownText';
import { useToast } from './useToast';
import { PollHeaderSection } from './currentPoll/PollHeaderSection';
import { AdminPanel } from './currentPoll/AdminPanel';
import { AdminEntriesSection } from './currentPoll/AdminEntriesSection';
import SubmissionSection from './currentPoll/SubmissionSection';
import { MySubmissionsSection } from './currentPoll/MySubmissionsSection';
import { PreviewSection } from './currentPoll/PreviewSection';
import { VotingSection } from './currentPoll/VotingSection';
import { RankingModal } from './currentPoll/RankingModal';
import type {
  AssetUploadResponse,
  PollEntryResponse,
  PollDetailResponse,
  PollResponse,
  FieldRequirement,
  SessionState,
  VoteResponse,
  VotingBreakdownEntry
} from '../types';
import { fromLocal, isMaxTimestamp, toLocal } from '../utils/format';

const RANK_COLORS = [
  'var(--rank-1, #3b82f6)',
  'var(--rank-2, #60a5fa)',
  'var(--rank-3, #93c5fd)',
  'var(--rank-4, #bfdbfe)',
  'var(--rank-5, #dbeafe)',
];

function ClosedPollRankBar({ rankCounts, totalVoters }: { rankCounts: { rank: number; votes: number }[]; totalVoters: number }) {
  if (rankCounts.length === 0 || totalVoters === 0) return null;
  const sorted = [...rankCounts].sort((a, b) => a.rank - b.rank);
  const totalRanked = sorted.reduce((sum, r) => sum + r.votes, 0);
  return (
    <div className="rank-distribution">
      <div className="rank-bar" title={sorted.map((r) => `#${r.rank}: ${r.votes}`).join(', ')}>
        {sorted.map((r) => {
          const pct = (r.votes / totalRanked) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={r.rank}
              className="rank-bar-segment"
              style={{
                width: `${pct}%`,
                backgroundColor: RANK_COLORS[r.rank - 1] ?? RANK_COLORS[RANK_COLORS.length - 1],
              }}
            />
          );
        })}
      </div>
      <div className="rank-legend">
        {sorted.map((r) => (
          <span key={r.rank} className="rank-legend-item">
            <span className="rank-legend-dot" style={{ backgroundColor: RANK_COLORS[r.rank - 1] ?? RANK_COLORS[RANK_COLORS.length - 1] }} />
            #{r.rank}: {r.votes}
          </span>
        ))}
      </div>
    </div>
  );
}

export type CurrentPollProps = {
  sessionState: SessionState;
  me: { isAdmin: boolean } | null;
  poll: PollResponse | null;
  pollDetail: PollDetailResponse | null;
  pollLoading: boolean;
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
  entryFileValidationPending: boolean;
  entryFileInvalid: boolean;
  entrySubmitError: string | null;
  entrySubmitSuccessCount: number;
  entrySubmitting: boolean;
  assetCache: Record<string, AssetUploadResponse>;
  onRefreshPoll: () => Promise<void> | void;
  onSelectPoll: (id: string) => void;
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
  onUpdateMetadata: (pollId: string, updates: { title?: string; description?: string; titleRequirement?: FieldRequirement; descriptionRequirement?: FieldRequirement; imageRequirement?: FieldRequirement }) => Promise<unknown>;
  onUpdateSubmissionSettings: (pollId: string, updates: { maxSubmissionsPerMember?: number; submissionClosesAt?: string | null; mustHaveJoinedBefore?: string | null }) => Promise<unknown>;
  onUpdateVotingSettings: (pollId: string, updates: { maxSelections?: number; votingClosesAt?: string | null; mustHaveJoinedBefore?: string | null }) => Promise<unknown>;
  uploadMaxFileSizeMB: number;
  onLogin: () => void;
  loginCta: string;
  loginDisabled: boolean;
};

export function CurrentPollPage(props: CurrentPollProps) {
  const {
    sessionState,
    poll,
    pollDetail,
    pollLoading,
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
    entryFileValidationPending,
    entryFileInvalid,
    entrySubmitError,
    entrySubmitSuccessCount,
    entrySubmitting,
    assetCache,
    onRefreshPoll,
    onSelectPoll,
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
    uploadMaxFileSizeMB,
    onLogin,
    loginCta,
    loginDisabled
  } = props;

  const location = useLocation();
  const { pollId } = useParams();
  const isNavigatingToDifferentPoll = !!pollId && poll?.id !== pollId;
  const shouldShowLoading = pollLoading || (isNavigatingToDifferentPoll && !pollError);
  const isClosed = poll?.status === 3 || poll?.status === 4;
  const showSubmissionSettings = !!poll && (poll.status === 0 || poll.status === 1);
  const showVotingSettings = !!poll && poll.status === 2;
  const showAdminEntries = !!poll && !isClosed && poll.isAdmin;
  const showBlurredPreview = !!poll && poll.imageRequirement !== 0 && poll.hideEntriesUntilVoting && (poll.status === 1 || poll.status === 5) && entries.length > 0;
  const showEntryTitleField = poll?.titleRequirement !== 0;
  const showEntryDescriptionField = poll?.descriptionRequirement !== 0;
  const myEntries = useMemo(() => entries.filter((e) => e.isOwn), [entries]);
  const submissionLimitReached = !!poll && poll.maxSubmissionsPerMember > 0 && myEntries.length >= poll.maxSubmissionsPerMember;
  const submissionsRemaining = poll && poll.maxSubmissionsPerMember > 0
    ? Math.max(0, poll.maxSubmissionsPerMember - myEntries.length)
    : null;
  const { showToast } = useToast();
  const [confirmConfig, setConfirmConfig] = useState<ConfirmDialogConfig | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState('');
  const [pendingAction, setPendingAction] = useState<'disqualify' | 'delete' | null>(null);
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxData | null>(null);
  const openLightbox = (imageUrl: string, originalUrl?: string, alt?: string) => {
    setLightboxImage({ imageUrl, originalUrl, alt });
  };
  const isRankedMethod = !!poll?.requireRanking;
  const breakdownByEntryId = useMemo(() => {
    const map = new Map<string, VotingBreakdownEntry>();
    votingBreakdown.forEach((b) => map.set(b.entryId, b));
    return map;
  }, [votingBreakdown]);
  const [irvStage, setIrvStage] = useState<'select' | 'rank'>('select');
  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverAfter, setDragOverAfter] = useState(false);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const prevVoteSubmittingRef = useRef(false);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const itemPositions = useRef<Record<string, number>>({});
  const lastSubmittedRanks = useMemo(() => {
    if (!poll?.requireRanking || !voteInfo) return [] as string[];
    return [...voteInfo.choices]
      .filter((c) => typeof c.rank === 'number')
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((c) => c.entryId);
  }, [poll?.requireRanking, voteInfo]);

  const hasRankChanges = useMemo(() => {
    if (!poll?.requireRanking) return true;
    if (rankedIds.length === 0) return true;
    if (rankedIds.length !== lastSubmittedRanks.length) return true;
    return rankedIds.some((id, idx) => id !== lastSubmittedRanks[idx]);
  }, [poll?.requireRanking, rankedIds, lastSubmittedRanks]);

  useLayoutEffect(() => {
    const prevPositions = itemPositions.current;
    const nextPositions: Record<string, number> = {};

    rankedIds.forEach((id) => {
      const el = itemRefs.current[id];
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      nextPositions[id] = top;

      const prevTop = prevPositions[id];
      if (typeof prevTop === 'number') {
        const delta = prevTop - top;
        if (delta !== 0) {
          el.style.transition = 'none';
          el.style.transform = `translateY(${delta}px)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = 'transform 180ms ease';
              el.style.transform = '';
            });
          });
        }
      }
    });

    itemPositions.current = nextPositions;
  }, [rankedIds]);
  const selectedEntries = useMemo(() => entries.filter((e) => voteState[e.id]?.selected), [entries, voteState]);
  const rankedEntries = useMemo(() => rankedIds.map((id) => entries.find((e) => e.id === id)).filter((e): e is PollEntryResponse => !!e), [entries, rankedIds]);
  const preferTeaserAssetForPreview = poll?.hideEntriesUntilVoting && (poll.status === 1 || poll.status === 5) && entries.length > 0;
  const preferTeaserAssetForParticipants = preferTeaserAssetForPreview && !poll?.isAdmin;
  const tiedForFirst = !!pollDetail && pollDetail.winners.length > 1 && pollDetail.winners.every((w) => w.votes === pollDetail.winners[0].votes);
  const irvVotesByEntryId = useMemo(() => {
    const m = new Map<string, number>();
    if (pollDetail) {
      for (const e of pollDetail.entries) {
        if (e.irvFinalVotes != null) m.set(e.id, e.irvFinalVotes);
      }
    }
    return m;
  }, [pollDetail]);
  const entriesForAdminSections = useMemo(() => {
    if (!poll?.isAdmin) return entries;
    return [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [entries, poll?.isAdmin]);
  const getEntryAssetId = (entry: { publicAssetId?: string; originalAssetId?: string }, preferTeaser: boolean) => {
    if (poll?.imageRequirement === 0) {
      return '';
    }

    if (preferTeaser) {
      return '';
    }
    return entry.publicAssetId ?? entry.originalAssetId ?? '';
  };
  const entryAssetId = (entry: { publicAssetId?: string; originalAssetId?: string }) => getEntryAssetId(entry, !!preferTeaserAssetForParticipants);
  const requirementOptions: Array<{ value: FieldRequirement; label: string }> = [
    { value: 0, label: 'Off' },
    { value: 1, label: 'Optional' },
    { value: 2, label: 'Required' }
  ];
  const [metaForm, setMetaForm] = useState({
    title: '',
    description: '',
    titleRequirement: 2 as FieldRequirement,
    descriptionRequirement: 1 as FieldRequirement,
    imageRequirement: 2 as FieldRequirement
  });
  const [submissionForm, setSubmissionForm] = useState({ maxSubmissionsPerMember: 1, submissionClosesAt: '', mustHaveJoinedBefore: '' });
  const [votingForm, setVotingForm] = useState({ maxSelections: 1, votingClosesAt: '', mustHaveJoinedBefore: '' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveSuccessCount, setSettingsSaveSuccessCount] = useState(0);

  useEffect(() => {
    if (pollError) showToast(pollError, { tone: 'error' });
  }, [pollError, showToast]);

  useEffect(() => {
    if (entriesError) showToast(entriesError, { tone: 'error' });
  }, [entriesError, showToast]);

  useEffect(() => {
    if (votingBreakdownError) showToast(votingBreakdownError, { tone: 'error' });
  }, [votingBreakdownError, showToast]);

  useEffect(() => {
    if (pollId) {
      onSelectPoll(pollId);
    }
    // Intentionally depend on route param only; onSelectPoll identity can change between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId]);

  useEffect(() => {
    if (!isClosed || !pollDetail) return;
    const hashValue = location.hash?.replace('#', '');
    if (!hashValue) return;

    const entryId = hashValue.startsWith('entry-') ? hashValue.slice('entry-'.length) : hashValue;
    const hasEntry = pollDetail.entries.some((e) => e.id === entryId);
    if (!hasEntry) return;

    setHighlightedEntryId(entryId);

    // Scroll into view twice to account for images/layout settling
    const scrollToEntry = () => {
      const target = document.getElementById(`entry-${entryId}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    };

    requestAnimationFrame(scrollToEntry);
    const lateScroll = window.setTimeout(scrollToEntry, 400);
    return () => window.clearTimeout(lateScroll);
  }, [isClosed, pollDetail, location.hash]);

  useEffect(() => {
    if (!highlightedEntryId) return;
    const timeout = window.setTimeout(() => setHighlightedEntryId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [highlightedEntryId]);

  useEffect(() => {
    if (!poll?.requireRanking) {
      setIrvStage('select');
      setRankedIds([]);
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
    setRankedIds(ordered);
  }, [poll?.id, poll?.requireRanking, voteInfo?.voteId, entries, voteState]);

  useEffect(() => {
    const justFinishedSuccessfulSubmit = prevVoteSubmittingRef.current && !voteSubmitting && !voteError;
    if (justFinishedSuccessfulSubmit && poll?.requireRanking && irvStage === 'rank') {
      setIrvStage('select');
      setDraggingId(null);
      setDragOverId(null);
      setDragOverAfter(false);
    }
    prevVoteSubmittingRef.current = voteSubmitting;
  }, [voteSubmitting, voteError, poll?.requireRanking, irvStage]);

  const buildMetaUpdates = () => {
    if (!poll) return null;
    const updates: { title?: string; description?: string; titleRequirement?: FieldRequirement; descriptionRequirement?: FieldRequirement; imageRequirement?: FieldRequirement } = {};
    if (metaForm.title !== poll.title) updates.title = metaForm.title;
    if ((metaForm.description || '') !== (poll.description ?? '')) updates.description = metaForm.description;
    if (metaForm.titleRequirement !== poll.titleRequirement) updates.titleRequirement = metaForm.titleRequirement;
    if (metaForm.descriptionRequirement !== poll.descriptionRequirement) updates.descriptionRequirement = metaForm.descriptionRequirement;
    if (metaForm.imageRequirement !== poll.imageRequirement) updates.imageRequirement = metaForm.imageRequirement;
    return Object.keys(updates).length > 0 ? updates : null;
  };

  const buildSubmissionUpdates = () => {
    if (!poll || !showSubmissionSettings) return null;
    const updates: { maxSubmissionsPerMember?: number; submissionClosesAt?: string | null; mustHaveJoinedBefore?: string | null } = {};
    const currentClose = isMaxTimestamp(poll.submissionClosesAt) ? '' : toLocal(poll.submissionClosesAt);
    const currentJoinCutoff = poll.mustHaveJoinedBefore ? toLocal(poll.mustHaveJoinedBefore) : '';
    if (submissionForm.maxSubmissionsPerMember !== poll.maxSubmissionsPerMember) {
      updates.maxSubmissionsPerMember = submissionForm.maxSubmissionsPerMember;
    }
    if (submissionForm.submissionClosesAt !== currentClose) {
      updates.submissionClosesAt = submissionForm.submissionClosesAt === '' ? null : fromLocal(submissionForm.submissionClosesAt);
    }
    if (submissionForm.mustHaveJoinedBefore !== currentJoinCutoff) {
      updates.mustHaveJoinedBefore = submissionForm.mustHaveJoinedBefore === '' ? null : fromLocal(submissionForm.mustHaveJoinedBefore);
    }
    return Object.keys(updates).length > 0 ? updates : null;
  };

  const buildVotingUpdates = () => {
    if (!poll || !showVotingSettings) return null;
    const updates: { maxSelections?: number; votingClosesAt?: string | null; mustHaveJoinedBefore?: string | null } = {};
    const currentClose = isMaxTimestamp(poll.votingClosesAt) ? '' : toLocal(poll.votingClosesAt);
    const currentJoinCutoff = poll.mustHaveJoinedBefore ? toLocal(poll.mustHaveJoinedBefore) : '';
    if (votingForm.maxSelections !== poll.maxSelections) {
      updates.maxSelections = votingForm.maxSelections;
    }
    if (votingForm.votingClosesAt !== currentClose) {
      updates.votingClosesAt = votingForm.votingClosesAt === '' ? null : fromLocal(votingForm.votingClosesAt);
    }
    if (votingForm.mustHaveJoinedBefore !== currentJoinCutoff) {
      updates.mustHaveJoinedBefore = votingForm.mustHaveJoinedBefore === '' ? null : fromLocal(votingForm.mustHaveJoinedBefore);
    }
    return Object.keys(updates).length > 0 ? updates : null;
  };

  const handleSaveSettings = async () => {
    if (!poll) return;

    if (metaForm.titleRequirement === 0 && metaForm.descriptionRequirement === 0 && metaForm.imageRequirement === 0) {
      showToast('Enable at least one submission field', { tone: 'error' });
      return;
    }

    const metaUpdates = buildMetaUpdates();
    const submissionUpdates = buildSubmissionUpdates();
    const votingUpdates = buildVotingUpdates();

    if (!metaUpdates && !submissionUpdates && !votingUpdates) {
      showToast('Nothing to update', { tone: 'info' });
      return;
    }

    setSettingsSaving(true);
    try {
      if (metaUpdates) await onUpdateMetadata(poll.id, metaUpdates);
      if (submissionUpdates) await onUpdateSubmissionSettings(poll.id, submissionUpdates);
      if (votingUpdates) await onUpdateVotingSettings(poll.id, votingUpdates);
      setSettingsSaveSuccessCount((prev) => prev + 1);
      showToast('Poll settings updated', { tone: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update poll settings', { tone: 'error' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleConfirm = () => {
    if (!pendingEntryId || !pendingAction) {
      setConfirmConfig(null);
      return;
    }

    if (pendingAction === 'disqualify') {
      if (!pendingReason.trim()) {
        return;
      }
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
      const message = 'Select at least one entry to rank';
      showToast(message, { tone: 'error' });
      return;
    }
    if (selectedEntries.length > poll.maxSelections) {
      const message = `Select at most ${poll.maxSelections} entries`;
      showToast(message, { tone: 'error' });
      return;
    }
    const selectedIds = selectedEntries.map((e) => e.id);
    const ordered = rankedIds.filter((id) => selectedIds.includes(id));
    const remaining = selectedIds.filter((id) => !ordered.includes(id));
    setRankedIds([...ordered, ...remaining]);
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
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
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
      const message = 'Select entries to rank';
      showToast(message, { tone: 'error' });
      return;
    }
    onSubmitVote(rankedIds);
  };

  const handleClearSelection = () => {
    entries.forEach((e) => handleToggleSelection(e.id, false));
    setRankedIds([]);
  };

  useEffect(() => {
    if (!poll) return;
    setMetaForm({
      title: poll.title,
      description: poll.description ?? '',
      titleRequirement: poll.titleRequirement,
      descriptionRequirement: poll.descriptionRequirement,
      imageRequirement: poll.imageRequirement
    });
    setSubmissionForm({
      maxSubmissionsPerMember: poll.maxSubmissionsPerMember,
      submissionClosesAt: isMaxTimestamp(poll.submissionClosesAt) ? '' : toLocal(poll.submissionClosesAt),
      mustHaveJoinedBefore: poll.mustHaveJoinedBefore ? toLocal(poll.mustHaveJoinedBefore) : ''
    });
    setVotingForm({
      maxSelections: poll.maxSelections,
      votingClosesAt: isMaxTimestamp(poll.votingClosesAt) ? '' : toLocal(poll.votingClosesAt),
      mustHaveJoinedBefore: poll.mustHaveJoinedBefore ? toLocal(poll.mustHaveJoinedBefore) : ''
    });
  }, [poll]);

  const disqualifyReasonRequired = pendingAction === 'disqualify' && pendingReason.trim().length === 0;

  const dialogConfig = confirmConfig
    ? {
        ...confirmConfig,
        confirmDisabled: disqualifyReasonRequired,
        content:
          pendingAction === 'disqualify'
            ? (
              <label className="stack">
                Reason
                <textarea
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  rows={3}
                />
                {disqualifyReasonRequired && <span className="field-error">Reason is required</span>}
              </label>
            )
            : confirmConfig.content
      }
    : null;

  if (sessionState !== 'authenticated') {
    return <AuthPrompt onLogin={onLogin} loginCta={loginCta} loginDisabled={loginDisabled} />;
  }

  if (shouldShowLoading) {
    return (
      <section className="card splash" data-testid="current-poll-loading">
        <p className="eyebrow">Loading</p>
        <h2>Please wait…</h2>
      </section>
    );
  }

  return (
    <div className="stack" data-testid="current-poll-page">
      <PollHeaderSection poll={poll} onRefreshPoll={onRefreshPoll} />

      {poll?.isAdmin && (
        <AdminPanel
          poll={poll}
          showSubmissionSettings={showSubmissionSettings}
          showVotingSettings={showVotingSettings}
          metaForm={metaForm}
          submissionForm={submissionForm}
          votingForm={votingForm}
          requirementOptions={requirementOptions}
          settingsSaving={settingsSaving}
          saveSuccessCount={settingsSaveSuccessCount}
          onMetaChange={setMetaForm}
          onSubmissionChange={setSubmissionForm}
          onVotingChange={setVotingForm}
          onTransition={onTransition}
          onDeletePoll={onDeletePoll}
          onSave={handleSaveSettings}
        />
      )}

      {showAdminEntries && poll && (
        <AdminEntriesSection
          poll={poll}
          winners={pollDetail?.winners ?? []}
          irvVotesByEntryId={irvVotesByEntryId}
          entries={entriesForAdminSections}
          entriesLoading={entriesLoading}
          votingBreakdown={votingBreakdown}
          votingBreakdownError={votingBreakdownError}
          breakdownByEntryId={breakdownByEntryId}
          assetCache={assetCache}
          entryAssetId={entryAssetId}
          onAskDisqualify={(entryId) => {
            setPendingEntryId(entryId);
            setPendingReason('');
            setPendingAction('disqualify');
            setConfirmConfig({
              title: 'Disqualify entry?',
              body: 'Provide a reason. This hides the entry from winning while keeping it visible',
              confirmLabel: 'Disqualify',
              cancelLabel: 'Cancel',
              tone: 'danger'
            });
          }}
          onRequalify={onRequalify}
          onAskDelete={(entryId) => {
            setPendingEntryId(entryId);
            setPendingAction('delete');
            setConfirmConfig({
              title: 'Delete entry?',
              body: 'This removes the entry and any uploaded assets',
              confirmLabel: 'Delete',
              cancelLabel: 'Cancel',
              tone: 'danger'
            });
          }}
        />
      )}

      {poll && !isClosed && (poll.canSubmit || !!poll.ineligibleToSubmitReason) && (
        <SubmissionSection
          poll={poll}
          entryForm={entryForm}
          entrySubmitting={entrySubmitting}
          entryFiles={entryFiles}
          entryFileValidationPending={entryFileValidationPending}
          entryFileInvalid={entryFileInvalid}
          entrySubmitError={entrySubmitError}
          entrySubmitSuccessCount={entrySubmitSuccessCount}
          submissionLimitReached={submissionLimitReached}
          submissionsRemaining={submissionsRemaining}
          showEntryTitleField={showEntryTitleField}
          showEntryDescriptionField={showEntryDescriptionField}
          onEntryFormChange={onEntryFormChange}
          onEntryFilesChange={onEntryFilesChange}
          maxUploadFileSizeMB={uploadMaxFileSizeMB}
          onSubmitEntry={onSubmitEntry}
        />
      )}

      {poll?.status === 1 && myEntries.length > 0 && (
        <MySubmissionsSection
          poll={poll}
          entries={myEntries}
          assetCache={assetCache}
          entryAssetId={entryAssetId}
          onAskDelete={(entryId) => {
            setPendingEntryId(entryId);
            setPendingAction('delete');
            setConfirmConfig({
              title: 'Delete your entry?',
              body: 'This removes the entry and any uploaded assets',
              confirmLabel: 'Delete',
              cancelLabel: 'Cancel',
              tone: 'danger'
            });
          }}
        />
      )}

      {showBlurredPreview && (
        <PreviewSection poll={poll} entries={entries} />
      )}

      {(poll?.canVote || !!poll?.ineligibleToVoteReason) && !isClosed && entries.length > 0 && (
        <VotingSection
          poll={poll}
          entries={entries}
          voteState={voteState}
          voteSubmitting={voteSubmitting}
          voteInfo={voteInfo}
          assetCache={assetCache}
          isRankedMethod={isRankedMethod}
          entryAssetId={entryAssetId}
          onToggleSelection={handleToggleSelection}
          onDisqualifiedSelectAttempt={() => {
            showToast('This entry is disqualified and cannot be selected', { tone: 'error' });
          }}
          onProceedToRanking={handleProceedToRanking}
          onSubmitVote={() => onSubmitVote()}
          onClearSelection={handleClearSelection}
        />
      )}

      {poll?.canVote && !isClosed && poll.requireRanking && !poll.ineligibleToVoteReason && (
        <RankingModal
          open={irvStage === 'rank'}
          poll={poll}
          rankedEntries={rankedEntries}
          draggingId={draggingId}
          dragOverId={dragOverId}
          dragOverAfter={dragOverAfter}
          hasRankChanges={hasRankChanges}
          voteSubmitting={voteSubmitting}
          hasExistingVote={!!voteInfo}
          assetCache={assetCache}
          entryAssetId={entryAssetId}
          onBackToSelection={handleBackToSelection}
          onSubmitRanks={handleRankSubmit}
          onMoveRank={moveRank}
          onDragStart={(id) => setDraggingId(id)}
          onDragOverItem={handleDragOverItem}
          onDropOnItem={handleDropOnItem}
          onDragEnd={() => {
            setDraggingId(null);
            setDragOverId(null);
            setDragOverAfter(false);
          }}
          setItemRef={(id, node) => { itemRefs.current[id] = node; }}
        />
      )}

      {isClosed && pollDetail && (
        <section className="card" data-testid="closed-poll-breakdown">
          <div className="section-head">
            <div>
              <p className="eyebrow">Entries</p>
              <h3>Full breakdown</h3>
            </div>
          </div>
          {pollDetail.entries.length === 0 && <p className="muted">No entries recorded</p>}
          {pollDetail.entries.length > 0 && (
            <ul className="entries entry-grid">
              {pollDetail.entries.map((e) => {
                const assetId = entryAssetId(e);
                const asset = assetCache[assetId];
                const originalUrl = e.originalAssetId ? assetCache[e.originalAssetId]?.url : undefined;
                const previewUrl = asset?.url;
                const fullImageUrl = previewUrl ? (originalUrl ?? previewUrl) : null;

                const isTieWinner = tiedForFirst && e.isWinner;
                const positionLabel = isTieWinner ? '#1' : (typeof e.position === 'number' ? `#${e.position}` : null);
                const entryDisplayName = (e.displayName || '').trim();
                const hasTitle = entryDisplayName.length > 0;
                const isPollTitleFallback = pollDetail.titleRequirement === 1
                  && hasTitle
                  && entryDisplayName === (pollDetail.title || '').trim();
                const titleText = pollDetail.titleRequirement === 0
                  ? 'Entry'
                  : (isPollTitleFallback ? 'Entry' : (hasTitle ? e.displayName : 'Untitled entry'));
                const highlightClass = highlightedEntryId === e.id ? 'entry-highlight' : '';
                return (
                  <li key={e.id} id={`entry-${e.id}`} className={`entry-card ${e.isWinner ? 'winner' : ''} ${e.isDisqualified ? 'unavailable' : ''} ${highlightClass}`}>
                    <div className="entry-head">
                      <div className="entry-meta">
                        <p className="entry-title">{titleText}</p>
                        {e.submittedByDisplayName && (
                          <p className="byline">
                            <span className="byline-label">By:</span>
                            <span className="byline-name">{e.submittedByDisplayName}</span>
                          </p>
                        )}
                      </div>
                      <div className="badges">
                        {positionLabel && <span className="pill subtle">{positionLabel}</span>}
                        {e.isWinner && <span className="pill winner">Winner</span>}
                        {isTieWinner && <span className="pill tie">Tie</span>}
                      </div>
                    </div>
                    {previewUrl && (
                      <button
                        type="button"
                        className="entry-img-button"
                        title="View full image"
                        onClick={() => openLightbox(fullImageUrl ?? previewUrl, originalUrl, e.displayName)}
                      >
                        <img src={previewUrl} alt={e.displayName || 'Entry image'} className="entry-img" />
                      </button>
                    )}
                    {e.isDisqualified && (
                      <div className="disqualification-details">
                        <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>
                        {poll.isAdmin && (e.disqualifiedByDisplayName || e.disqualifiedAt) && (
                          <p className="disqualification-meta">
                            <span className="byline">
                              <span className="byline-label">By:</span>
                              <span className="byline-name">{e.disqualifiedByDisplayName ?? 'unknown admin'}</span>
                            </span>
                            {e.disqualifiedAt ? ` on ${new Date(e.disqualifiedAt).toLocaleString()}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                    {e.description && <MarkdownText content={e.description} className="muted entry-description" />}
                    <div className="actions entry-breakdown-summary">
                      {pollDetail.votingMethod === 2 ? (
                        <span className="pill subtle">Final votes: {e.irvFinalVotes ?? '–'}</span>
                      ) : (
                        <span className="pill subtle">{e.approvalVotes} people approved</span>
                      )}
                    </div>
                    {pollDetail.votingMethod === 2 && e.rankCounts.length > 0 && (
                      <ClosedPollRankBar rankCounts={e.rankCounts} totalVoters={pollDetail.totalVotes} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage.imageUrl}
          originalUrl={lightboxImage.originalUrl}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}
      <ConfirmDialog config={dialogConfig} onConfirm={handleConfirm} onCancel={handleCancelConfirm} />
    </div>
  );
}
