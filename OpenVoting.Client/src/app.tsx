/// <reference types="w3c-web-usb" />
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import './app.css';
import {
  ActivePollsPage,
  CurrentPollPage,
  HistoryPage,
  NotFound,
  PageShell,
  Topbar,
  ConfirmDialog,
  type ConfirmDialogConfig,
  votingMethodOptions
} from './components';
import type {
  AssetUploadResponse,
  ConfigResponse,
  MeResponse,
  PollDetailResponse,
  PollEntryResponse,
  PollHistoryResponse,
  PollResponse,
  SessionState,
  VoteResponse,
  VotingBreakdownEntry
} from './types';

const tokenKey = 'ov_token';

const defaultCreateForm = {
  title: 'New competition',
  description: '',
  votingMethod: 1
};

const defaultEntryForm = {
  displayName: '',
  description: ''
};

const maxUploadBytes = 5 * 1024 * 1024;

export default function App() {
  const [token, setToken] = useState<string>('');
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [poll, setPoll] = useState<PollResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [activePolls, setActivePolls] = useState<PollResponse[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [pollDetail, setPollDetail] = useState<PollDetailResponse | null>(null);
  const [entries, setEntries] = useState<PollEntryResponse[]>([]);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [assetCache, setAssetCache] = useState<Record<string, AssetUploadResponse>>({});

  const [entryForm, setEntryForm] = useState(defaultEntryForm);
  const [entryFiles, setEntryFiles] = useState<{ original?: File }>({});
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entrySubmitError, setEntrySubmitError] = useState<string | null>(null);

  const [voteState, setVoteState] = useState<Record<string, { selected: boolean; rank: string }>>({});
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteInfo, setVoteInfo] = useState<VoteResponse | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmDialogConfig | null>(null);
  const confirmResolver = useRef<((result: boolean) => void) | null>(null);
  const [openVotingModal, setOpenVotingModal] = useState<{ pollId: string; selectedMethod: number; submitting: boolean } | null>(null);

  const [history, setHistory] = useState<PollHistoryResponse[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [votingBreakdown, setVotingBreakdown] = useState<VotingBreakdownEntry[]>([]);
  const [votingBreakdownError, setVotingBreakdownError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchConfig();
    const saved = localStorage.getItem(tokenKey);
    if (saved) {
      setToken(saved);
    } else {
      setSessionState('anonymous');
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setSessionState('anonymous');
      resetPollState();
      return;
    }

    const bootstrap = async () => {
      setSessionState('loading');
      try {
        await fetchMe();
        await refreshActiveAndSelected();
        await fetchHistory();
        setSessionState('authenticated');
      } catch (err) {
        if ((err as Error).message === 'Unauthorized') {
          return;
        }
        setFlash((err as Error).message || 'Unable to refresh session');
      }
    };

    bootstrap();
  }, [token]);

  useEffect(() => {
    const name = config?.serverName?.trim() || 'Voting';
    document.title = `${name} Voting`;
  }, [config?.serverName]);

  useEffect(() => {
    history.forEach((p) => p.winners.forEach((w) => w.assetId && loadAsset(w.assetId)));
  }, [history]);

  const pollById = (id: string | null) => {
    if (!id) return null;
    if (poll?.id === id) return poll;
    return activePolls.find((p) => p.id === id) ?? null;
  };

  const requestConfirm = (config: ConfirmDialogConfig) => new Promise<boolean>((resolve) => {
    confirmResolver.current = resolve;
    setConfirmConfig(config);
  });

  const settleConfirm = (result: boolean) => {
    if (confirmResolver.current) {
      confirmResolver.current(result);
    }
    confirmResolver.current = null;
    setConfirmConfig(null);
  };

  useEffect(() => () => {
    if (confirmResolver.current) {
      confirmResolver.current(false);
    }
    confirmResolver.current = null;
  }, []);

  const authedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      logout('Your session expired. Please sign in again.');
      throw new Error('Unauthorized');
    }

    return res;
  };

  const logout = (message?: string) => {
    localStorage.removeItem(tokenKey);
    setToken('');
    setMe(null);
    resetPollState();
    setHistory([]);
    setVotingBreakdown([]);
    setVotingBreakdownError(null);
    setSessionState('anonymous');
    setFlash(message && message.trim().length > 0 ? message : 'Signed out.');
  };

  const clearSelectedPollData = () => {
    setPoll(null);
    setPollDetail(null);
    setEntries([]);
    setEntriesError(null);
    setEntriesLoading(false);
    setVoteState({});
    setVoteError(null);
    setVoteInfo(null);
  };

  const resetPollState = () => {
    setPoll(null);
    setPollError(null);
    setSelectedPollId(null);
    setActivePolls([]);
    clearSelectedPollData();
    setVotingBreakdown([]);
    setVotingBreakdownError(null);
  };

  const fetchConfig = async () => {
    setConfigError(null);
    try {
      const res = await fetch('/api/config');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: ConfigResponse = await res.json();
      setConfig(data);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to load config');
    }
  };

  const fetchMe = async (): Promise<MeResponse> => {
    const res = await authedFetch('/api/auth/me');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data: MeResponse = await res.json();
    setMe(data);
    return data;
  };

  const createPoll = async () => {
    setCreateError(null);
    const latestActive = activePolls.length === 0 ? await fetchActivePolls() : activePolls;
    const activeCount = latestActive.length;
    if (activeCount > 0) {
      const proceed = await requestConfirm({
        title: 'Create another active poll?',
        body: `There ${activeCount === 1 ? 'is' : 'are'} already ${activeCount} active poll${activeCount === 1 ? '' : 's'}. Do you want to create another?`,
        confirmLabel: 'Create poll'
      });
      if (!proceed) {
        return;
      }
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        title: createForm.title,
        description: createForm.description || undefined,
        votingMethod: createForm.votingMethod
      };

      const res = await authedFetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const created: PollResponse = await res.json();
      setSelectedPollId(created.id);
      await fetchActivePolls();
      await refreshPoll(true, created.id);
      navigate('/polls/live');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const refreshPoll = async (hydrate: boolean, targetPollId?: string) => {
    if (!token) return null;
    setPollError(null);
    const targetId = targetPollId ?? selectedPollId ?? null;
    if (!targetId) {
      clearSelectedPollData();
      return null;
    }
    const res = await authedFetch(`/api/polls/${targetId}/summary`);
    if (res.status === 404 || res.status === 204) {
      clearSelectedPollData();
      return null;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data: PollResponse = await res.json();
    setPoll(data);
    setSelectedPollId(data.id);
    if (!data.isAdmin || (data.status !== 2 && data.status !== 5)) {
      setVotingBreakdown([]);
      setVotingBreakdownError(null);
    }
    if (hydrate) {
      await Promise.all([fetchEntries(data.id), fetchVote(data.id)]);
      await fetchPollDetail(data.id);
      if (data.isAdmin && (data.status === 2 || data.status === 5)) {
        await fetchVotingBreakdown(data.id);
      }
    }
    return data;
  };

  const fetchVotingBreakdown = async (pollId: string) => {
    setVotingBreakdownError(null);
    try {
      const res = await authedFetch(`/api/polls/${pollId}/tally`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const tally: VotingBreakdownEntry[] = await res.json();
      setVotingBreakdown(tally);
    } catch (err) {
      setVotingBreakdownError(err instanceof Error ? err.message : 'Failed to load voting breakdown');
    }
  };

  const fetchHistory = async () => {
    if (!token) return;
    setHistoryError(null);
    const res = await authedFetch('/api/polls/history');
    if (res.status === 204) {
      setHistory([]);
      return;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data: PollHistoryResponse[] = await res.json();
    setHistory(data);
  };

  const fetchActivePolls = async (): Promise<PollResponse[]> => {
    if (!token) return [];
    setActiveLoading(true);
    try {
      const res = await authedFetch('/api/polls/active');
      if (res.status === 204 || res.status === 403) {
        setActivePolls([]);
        setSelectedPollId(null);
        return [];
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: PollResponse[] = await res.json();
      setActivePolls(data);
      if (!selectedPollId || !data.some((p) => p.id === selectedPollId)) {
        setSelectedPollId(data[0]?.id ?? null);
      }
      return data;
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to load polls');
      setActivePolls([]);
      setSelectedPollId(null);
      return [];
    } finally {
      setActiveLoading(false);
    }
  };

  const fetchPollDetail = async (pollId: string) => {
    if (!token) throw new Error('Not authenticated');
    const res = await authedFetch(`/api/polls/${pollId}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data: PollDetailResponse = await res.json();
    setPollDetail(data);
    loadAssetsForEntries(data.entries);
    return data;
  };

  const fetchEntries = async (pollId?: string) => {
    if (!token || !(pollId ?? poll?.id)) return;
    const targetId = pollId ?? poll?.id;
    setEntriesError(null);
    setEntriesLoading(true);
    try {
      const res = await authedFetch(`/api/polls/${targetId}/entries`);
      if (res.status === 204) {
        setEntries([]);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: PollEntryResponse[] = await res.json();
      setEntries(data);
      loadAssetsForEntries(data);
      setVoteState((prev) => {
        const next: Record<string, { selected: boolean; rank: string }> = {};
        data.forEach((e) => {
          next[e.id] = prev[e.id] ?? { selected: false, rank: '' };
        });
        return next;
      });
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  };

  const fetchVote = async (pollId?: string) => {
    if (!token || !(pollId ?? poll?.id)) return;
    const targetId = pollId ?? poll?.id;
    const res = await authedFetch(`/api/polls/${targetId}/vote`);
    if (res.status === 204) {
      setVoteInfo(null);
      return;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data: VoteResponse = await res.json();
    setVoteInfo(data);
    setVoteState((prev) => {
      const next = { ...prev } as Record<string, { selected: boolean; rank: string }>;
      data.choices.forEach((c) => {
        next[c.entryId] = { selected: true, rank: c.rank ? String(c.rank) : '' };
      });
      return next;
    });
  };

  const onRefreshBreakdown = async () => {
    if (!poll?.id || !poll.isAdmin || (poll.status !== 2 && poll.status !== 5)) {
      setVotingBreakdown([]);
      setVotingBreakdownError(null);
      return;
    }
    await fetchVotingBreakdown(poll.id);
  };

  const readImageDimensions = (file: File) => new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read the selected image.'));
    };
    image.src = objectUrl;
  });

  const validateImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file.');
    }

    if (file.size > maxUploadBytes) {
      throw new Error('Images must be 5MB or smaller.');
    }

    const { width, height } = await readImageDimensions(file);
    if (width !== height) {
      throw new Error('Images must be square (1:1 aspect ratio).');
    }

    if (width < 512 || height < 512) {
      throw new Error('Images must be at least 512×512.');
    }
  };

  const loadAsset = async (id?: string) => {
    if (!id || assetCache[id]) return;
    try {
      const res = await authedFetch(`/api/assets/${id}`);
      if (!res.ok) return;
      const data: AssetUploadResponse = await res.json();
      setAssetCache((prev) => ({ ...prev, [id]: data }));
    } catch {
      // Suppress asset load errors
    }
  };

  const loadAssetsForEntries = (data: Array<{ originalAssetId?: string; publicAssetId?: string; teaserAssetId?: string }>) => {
    const ids = new Set<string>();
    data.forEach((e) => {
      if (e.publicAssetId) ids.add(e.publicAssetId);
      if (e.teaserAssetId) ids.add(e.teaserAssetId);
      if (e.originalAssetId) ids.add(e.originalAssetId);
    });
    ids.forEach((id) => loadAsset(id));
  };

  const uploadAsset = async (file: File): Promise<AssetUploadResponse> => {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch('/api/assets', {
      method: 'POST',
      body: form
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json();
  };

  const submitEntry = async () => {
    if (!poll) return;
    setEntrySubmitError(null);
    setEntrySubmitting(true);
    try {
      if (!entryFiles.original) {
        throw new Error('Upload an image to submit.');
      }

      if (!entryForm.displayName.trim()) {
        throw new Error('Display name is required.');
      }

      await validateImageFile(entryFiles.original);

      const upload = await uploadAsset(entryFiles.original);
      const originalId = upload.id;

      const res = await authedFetch(`/api/polls/${poll.id}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: entryForm.displayName.trim(),
          description: entryForm.description.trim() || undefined,
          originalAssetId: originalId
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await fetchEntries(poll.id);
      setEntryForm(defaultEntryForm);
      setEntryFiles({});
    } catch (err) {
      setEntrySubmitError(err instanceof Error ? err.message : 'Failed to submit entry');
    } finally {
      setEntrySubmitting(false);
    }
  };

  const handleEntryFilesChange = (files: { original?: File }) => {
    setEntrySubmitError(null);

    const file = files.original;
    if (!file) {
      setEntryFiles({});
      return;
    }

    validateImageFile(file)
      .then(() => setEntryFiles(files))
      .catch((err) => {
        setEntryFiles({});
        setEntrySubmitError(err instanceof Error ? err.message : 'Please choose a square image under 5MB and at least 512×512.');
      });
  };

  const disqualifyEntry = async (entryId: string, reason: string) => {
    if (!poll?.id) return;
    try {
      const res = await authedFetch(`/api/polls/${poll.id}/entries/${entryId}/disqualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await fetchEntries(poll.id);
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : 'Failed to disqualify entry');
    }
  };

  const requalifyEntry = async (entryId: string) => {
    if (!poll?.id) return;
    try {
      const res = await authedFetch(`/api/polls/${poll.id}/entries/${entryId}/requalify`, {
        method: 'POST'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await fetchEntries(poll.id);
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : 'Failed to requalify entry');
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!poll?.id) return;
    try {
      const res = await authedFetch(`/api/polls/${poll.id}/entries/${entryId}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await Promise.all([
        fetchEntries(poll.id),
        fetchPollDetail(poll.id)
      ]);
    } catch (err) {
      setEntriesError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const toggleSelection = (entryId: string, selected: boolean) => {
    setVoteState((prev) => ({
      ...prev,
      [entryId]: { selected, rank: prev[entryId]?.rank ?? '' }
    }));
  };

  const updateRank = (entryId: string, rank: string) => {
    setVoteState((prev) => ({
      ...prev,
      [entryId]: { selected: prev[entryId]?.selected ?? false, rank }
    }));
  };

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({ id, message });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4000);
  };

  const submitVote = async (rankedIds?: string[]) => {
    if (!poll) return;
    setVoteError(null);
    setVoteSubmitting(true);

    let selected: Array<{ entryId: string; rank: string }>;

    if (rankedIds) {
      selected = rankedIds.map((id, idx) => ({ entryId: id, rank: String(idx + 1) }));
      setVoteState((prev) => {
        const next = { ...prev } as Record<string, { selected: boolean; rank: string }>;
        rankedIds.forEach((id, idx) => {
          next[id] = { selected: true, rank: String(idx + 1) };
        });
        Object.keys(next).forEach((id) => {
          if (!rankedIds.includes(id)) {
            next[id] = { selected: false, rank: '' };
          }
        });
        return next;
      });
    } else {
      selected = Object.entries(voteState)
        .filter(([, v]) => v.selected)
        .map(([id, v]) => ({ entryId: id, rank: v.rank }));
    }

    if (selected.length === 0) {
      setVoteError('Select at least one entry');
      setVoteSubmitting(false);
      return;
    }

    if (selected.length > poll.maxSelections) {
      setVoteError(`Select at most ${poll.maxSelections} entries`);
      setVoteSubmitting(false);
      return;
    }

    if (poll.requireRanking) {
      if (rankedIds && new Set(rankedIds).size !== rankedIds.length) {
        setVoteError('Ranked choices must be unique');
        setVoteSubmitting(false);
        return;
      }
      const ranks = selected.map((s) => Number(s.rank));
      if (!rankedIds) {
        if (ranks.some((r) => Number.isNaN(r) || r < 1 || r > selected.length)) {
          setVoteError('Ranks must be between 1 and the number of selected entries');
          setVoteSubmitting(false);
          return;
        }
        if (new Set(ranks).size !== ranks.length) {
          setVoteError('Ranks must be unique');
          setVoteSubmitting(false);
          return;
        }
      }
    } else if (selected.some((s) => s.rank)) {
      setVoteError('Do not supply ranks for this poll');
      setVoteSubmitting(false);
      return;
    }

    const payload = {
      choices: selected.map((s) => ({ entryId: s.entryId, rank: s.rank ? Number(s.rank) : undefined }))
    };

    try {
      const res = await authedFetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: VoteResponse = await res.json();
      setVoteInfo(data);
      showToast('Vote saved');
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setVoteSubmitting(false);
    }
  };

  const transitionPoll = async (pollId: string, path: string) => {
    if (path === 'open-voting') {
      const currentMethod = pollById(pollId)?.votingMethod ?? 1;
      setOpenVotingModal({ pollId, selectedMethod: currentMethod, submitting: false });
      return;
    }

    const confirmation: ConfirmDialogConfig = (() => {
      switch (path) {
        case 'open-submissions':
          return {
            title: 'Open submissions?',
            body: 'Submissions will open immediately and members can start sending entries.',
            confirmLabel: 'Open submissions'
          };
        case 'start-review':
          return {
            title: 'Start review?',
            body: 'Stop new submissions and move this poll into the review stage?',
            confirmLabel: 'Start review'
          };
        case 'close':
          return {
            title: 'Close poll?',
            body: 'End voting and publish results for this poll?',
            confirmLabel: 'Close poll'
          };
        default:
          return {
            title: 'Proceed with poll change?',
            body: 'Do you want to continue with this action?',
            confirmLabel: 'Continue'
          };
      }
    })();

    const confirmed = await requestConfirm(confirmation);
    if (!confirmed) return;

    try {
      const res = await authedFetch(`/api/polls/${pollId}/${path}`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      setSelectedPollId(pollId);
      await refreshPoll(true, pollId);
      await fetchActivePolls();
      if (path === 'close') {
        await fetchHistory();
      }
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to update poll');
    }
  };

  const handleConfirmOpenVoting = async () => {
    if (!openVotingModal) return;
    setPollError(null);
    setOpenVotingModal((prev) => (prev ? { ...prev, submitting: true } : prev));

    try {
      const targetId = openVotingModal.pollId;
      const currentMethod = pollById(targetId)?.votingMethod;
      const desiredMethod = openVotingModal.selectedMethod;

      if (currentMethod !== desiredMethod) {
        const updateRes = await authedFetch(`/api/polls/${targetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ votingMethod: desiredMethod })
        });
        if (!updateRes.ok) {
          const text = await updateRes.text();
          throw new Error(text || updateRes.statusText);
        }
      }

      const res = await authedFetch(`/api/polls/${targetId}/open-voting`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      setSelectedPollId(targetId);
      await refreshPoll(true, targetId);
      await fetchActivePolls();
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to open voting');
    } finally {
      setOpenVotingModal(null);
    }
  };

  const handleCancelOpenVoting = () => setOpenVotingModal(null);

  const deletePoll = async (pollId: string) => {
    const wasClosed = poll?.id === pollId && (poll.status === 3 || poll.status === 4);
    const confirmed = await requestConfirm({
      title: 'Delete poll?',
      body: 'Delete this poll and its assets? This cannot be undone.',
      confirmLabel: 'Delete poll',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await authedFetch(`/api/polls/${pollId}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      if (selectedPollId === pollId) {
        clearSelectedPollData();
        setSelectedPollId(null);
      }

      setHistory((prev) => prev.filter((p) => p.id !== pollId));
      await fetchActivePolls();
      await fetchHistory();
      navigate(wasClosed ? '/polls/history' : '/polls/live');
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to delete poll');
    }
  };

  const updatePollMetadata = async (pollId: string, updates: { title?: string; description?: string }) => {
    const payload: Record<string, unknown> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;

    try {
      const res = await authedFetch(`/api/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const updated: PollResponse = await res.json();
      setSelectedPollId(updated.id);
      await refreshPoll(true, updated.id);
      await fetchActivePolls();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update poll';
      setPollError(message);
      throw err;
    }
  };

  const updateSubmissionSettings = async (pollId: string, updates: { maxSubmissionsPerMember?: number; submissionClosesAt?: string | null }) => {
    const payload: Record<string, unknown> = {};
    if (updates.maxSubmissionsPerMember !== undefined) payload.maxSubmissionsPerMember = updates.maxSubmissionsPerMember;
    if (updates.submissionClosesAt === null) payload.clearSubmissionClosesAt = true;
    else if (updates.submissionClosesAt !== undefined) payload.submissionClosesAt = updates.submissionClosesAt;

    try {
      const res = await authedFetch(`/api/polls/${pollId}/submission-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const updated: PollResponse = await res.json();
      setSelectedPollId(updated.id);
      await refreshPoll(true, updated.id);
      await fetchActivePolls();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update submission settings';
      setPollError(message);
      throw err;
    }
  };

  const updateVotingSettings = async (pollId: string, updates: { maxSelections?: number; votingClosesAt?: string | null }) => {
    const payload: Record<string, unknown> = {};
    if (updates.maxSelections !== undefined) payload.maxSelections = updates.maxSelections;
    if (updates.votingClosesAt === null) payload.clearVotingClosesAt = true;
    else if (updates.votingClosesAt !== undefined) payload.votingClosesAt = updates.votingClosesAt;

    try {
      const res = await authedFetch(`/api/polls/${pollId}/voting-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const updated: PollResponse = await res.json();
      setSelectedPollId(updated.id);
      await refreshPoll(true, updated.id);
      await fetchActivePolls();
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update voting settings';
      setPollError(message);
      throw err;
    }
  };

  const handleSelectPoll = async (pollId: string) => {
    setSelectedPollId(pollId);
    setPollError(null);
    try {
      await refreshPoll(true, pollId);
      if (poll?.isAdmin && (poll.status === 2 || poll.status === 5)) {
        await fetchVotingBreakdown(pollId);
      }
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to load poll');
    }
  };

  const refreshActiveAndSelected = async () => {
    const actives = await fetchActivePolls();
    let targetId = selectedPollId;
    if (!targetId || (actives.length > 0 && !actives.some((p) => p.id === targetId))) {
      targetId = actives[0]?.id ?? null;
    }
    setSelectedPollId(targetId);
    if (targetId) {
      await refreshPoll(true, targetId);
    } else {
      clearSelectedPollData();
      setPollError(null);
    }
  };

  const loginCta = useMemo(() => {
    if (sessionState === 'loading') return 'Checking your account…';
    if (config?.discordAuthorizeUrl) return 'Sign in with Discord';
    return 'Sign in';
  }, [config?.discordAuthorizeUrl, sessionState]);

  const handleLogin = () => {
    if (config?.discordAuthorizeUrl) {
      window.location.href = config.discordAuthorizeUrl;
    }
  };

  const isBootstrapping = sessionState === 'idle' || sessionState === 'loading';
  const hasLivePolls = activePolls.length > 0;

  return (
    <PageShell topbar={
      <Topbar
        sessionState={sessionState}
        me={me}
        config={config}
        loginCta={loginCta}
        hasLivePolls={hasLivePolls}
        onLogin={handleLogin}
        onLogout={logout}
      />
    } flash={flash} configError={configError}>
      {isBootstrapping ? (
        <section className="card splash">
          <p className="eyebrow">Loading</p>
          <h2>Preparing your session…</h2>
          <p className="muted">Checking server config and your sign-in status.</p>
        </section>
      ) : (
      <Routes>
        <Route path="/" element={<Navigate to="/polls/live" replace />} />
        <Route
          path="/polls/live"
          element={
            <ActivePollsPage
              sessionState={sessionState}
              me={me}
              activePolls={activePolls}
              pollError={pollError}
              loading={activeLoading}
              onRefresh={refreshActiveAndSelected}
              createForm={createForm}
              setCreateForm={setCreateForm}
              creating={creating}
              createError={createError}
              onCreatePoll={createPoll}
            />
          }
        />
        <Route
          path="/polls/live/:pollId"
          element={
            <CurrentPollPage
              sessionState={sessionState}
              me={me}
              poll={poll}
              pollError={pollError}
              pollDetail={pollDetail}
              entries={entries}
              entriesError={entriesError}
              entriesLoading={entriesLoading}
              voteState={voteState}
              voteError={voteError}
              voteSubmitting={voteSubmitting}
              voteInfo={voteInfo}
              votingBreakdown={votingBreakdown}
              votingBreakdownError={votingBreakdownError}
              entryForm={entryForm}
              entryFiles={entryFiles}
              entrySubmitError={entrySubmitError}
              entrySubmitting={entrySubmitting}
              assetCache={assetCache}
              onRefreshPoll={refreshActiveAndSelected}
              onSelectPoll={handleSelectPoll}
              onRefreshEntries={() => fetchEntries()}
              onToggleSelection={toggleSelection}
              onUpdateRank={updateRank}
              onSubmitVote={submitVote}
              onSubmitEntry={submitEntry}
              onEntryFormChange={setEntryForm}
              onEntryFilesChange={handleEntryFilesChange}
              onDisqualify={disqualifyEntry}
              onRequalify={requalifyEntry}
              onDeleteEntry={deleteEntry}
              onTransition={transitionPoll}
              onDeletePoll={deletePoll}
              onUpdateMetadata={updatePollMetadata}
              onUpdateSubmissionSettings={updateSubmissionSettings}
              onUpdateVotingSettings={updateVotingSettings}
              onRefreshBreakdown={onRefreshBreakdown}
            />
          }
        />
        <Route
          path="/polls/:pollId"
          element={
            <CurrentPollPage
              sessionState={sessionState}
              me={me}
              poll={poll}
              pollError={pollError}
              pollDetail={pollDetail}
              entries={entries}
              entriesError={entriesError}
              entriesLoading={entriesLoading}
              voteState={voteState}
              voteError={voteError}
              voteSubmitting={voteSubmitting}
              voteInfo={voteInfo}
              votingBreakdown={votingBreakdown}
              votingBreakdownError={votingBreakdownError}
              entryForm={entryForm}
              entryFiles={entryFiles}
              entrySubmitError={entrySubmitError}
              entrySubmitting={entrySubmitting}
              assetCache={assetCache}
              onRefreshPoll={refreshActiveAndSelected}
              onSelectPoll={handleSelectPoll}
              onRefreshEntries={() => fetchEntries()}
              onToggleSelection={toggleSelection}
              onUpdateRank={updateRank}
              onSubmitVote={submitVote}
              onSubmitEntry={submitEntry}
              onEntryFormChange={setEntryForm}
              onEntryFilesChange={handleEntryFilesChange}
              onDisqualify={disqualifyEntry}
              onRequalify={requalifyEntry}
              onDeleteEntry={deleteEntry}
              onTransition={transitionPoll}
              onDeletePoll={deletePoll}
              onUpdateMetadata={updatePollMetadata}
              onUpdateSubmissionSettings={updateSubmissionSettings}
              onUpdateVotingSettings={updateVotingSettings}
              onRefreshBreakdown={onRefreshBreakdown}
            />
          }
        />
        <Route
          path="/polls/history"
          element={
            <HistoryPage
              sessionState={sessionState}
              history={history}
              historyError={historyError}
              assetCache={assetCache}
              onRefresh={fetchHistory}
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      )}
      {openVotingModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && handleCancelOpenVoting()}>
          <div className="modal-card">
            <p className="eyebrow">Voting</p>
            <h3>Open voting</h3>
            <p className="muted">Choose the voting method to use. This cannot be changed after voting starts.</p>
            <div className="method-cards">
              {votingMethodOptions.map((opt) => (
                <label key={opt.id} className={`radio-card ${openVotingModal.selectedMethod === opt.id ? 'selected' : ''}`}>
                  <div className="radio-head">
                    <input
                      type="radio"
                      name="voting-method"
                      value={opt.id}
                      checked={openVotingModal.selectedMethod === opt.id}
                      onChange={() => setOpenVotingModal((prev) => (prev ? { ...prev, selectedMethod: opt.id } : prev))}
                    />
                    <div>
                      <strong>{opt.name}</strong>
                      <p className="muted">{opt.summary}</p>
                    </div>
                  </div>
                  <ul>
                    {opt.steps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={handleCancelOpenVoting} disabled={openVotingModal.submitting}>Cancel</button>
              <button className="primary" onClick={handleConfirmOpenVoting} disabled={openVotingModal.submitting}>
                {openVotingModal.submitting ? 'Opening…' : 'Open voting'}
              </button>
            </div>
            <p className="muted">Voting method cannot be modified after the vote has started.</p>
          </div>
        </div>
      )}
      <ConfirmDialog config={confirmConfig} onConfirm={() => settleConfirm(true)} onCancel={() => settleConfirm(false)} />
      {toast && (
        <div className="toast" role="status" onClick={() => setToast(null)}>
          <span>{toast.message}</span>
        </div>
      )}
    </PageShell>
  );
}
