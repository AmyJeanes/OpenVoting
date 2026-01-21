/// <reference types="w3c-web-usb" />
import { useEffect, useState } from 'react';
import './app.css';

type MeResponse = {
  memberId: string;
  communityId: string;
  displayName: string;
  joinedAt: string;
  isEligible: boolean;
  ineligibleReason?: string;
  isAdmin: boolean;
};

type PollResponse = {
  id: string;
  title: string;
  description?: string;
  status: number;
  votingMethod: number;
  submissionOpensAt: string;
  submissionClosesAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
  hideEntriesUntilVoting: boolean;
  maxSelections: number;
  requireRanking: boolean;
  maxSubmissionsPerMember: number;
  mustHaveJoinedBefore?: string;
  requiredRoleIds: string[];
  canSubmit: boolean;
  canVote: boolean;
  isAdmin: boolean;
};

type PollWinnerResponse = {
  entryId: string;
  displayName: string;
  votes: number;
};

type PollHistoryResponse = {
  id: string;
  title: string;
  status: number;
  votingMethod: number;
  votingClosesAt: string;
  winners: PollWinnerResponse[];
};

type PollEntryResponse = {
  id: string;
  displayName: string;
  description?: string;
  originalAssetId: string;
  teaserAssetId?: string;
  publicAssetId?: string;
  isDisqualified: boolean;
  disqualificationReason?: string;
  createdAt: string;
};

type VoteChoiceResponse = {
  entryId: string;
  rank?: number;
};

type VoteResponse = {
  voteId: string;
  pollId: string;
  memberId: string;
  isFinal: boolean;
  submittedAt?: string;
  choices: VoteChoiceResponse[];
};

type AssetUploadResponse = {
  id: string;
  storageKey: string;
  contentType: string;
  bytes: number;
  sha256: string;
  url?: string;
};

type ConfigResponse = {
  discordAuthorizeUrl: string;
  redirectUri: string;
};

const tokenKey = 'ov_token';

export default function App() {
  const [token, setToken] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [poll, setPoll] = useState<PollResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PollEntryResponse[] | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entryForm, setEntryForm] = useState({
    displayName: '',
    description: '',
    originalAssetId: '',
    teaserAssetId: '',
    publicAssetId: ''
  });
  const [entryFiles, setEntryFiles] = useState<{ original?: File; teaser?: File; public?: File }>({});
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entrySubmitError, setEntrySubmitError] = useState<string | null>(null);
  const [assetCache, setAssetCache] = useState<Record<string, AssetUploadResponse>>({});
  const [voteState, setVoteState] = useState<Record<string, { selected: boolean; rank: string }>>({});
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteInfo, setVoteInfo] = useState<VoteResponse | null>(null);
  const [createForm, setCreateForm] = useState({
    title: 'Logo Vote',
    description: '',
    submissionOpensAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    submissionClosesAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    votingOpensAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    votingClosesAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    hideEntriesUntilVoting: true,
    maxSelections: 5,
    requireRanking: false,
    maxSubmissionsPerMember: 1,
    votingMethod: 1
  });
  const [history, setHistory] = useState<PollHistoryResponse[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(tokenKey);
    if (saved) {
      setToken(saved);
    }
    fetchConfig();
  }, []);

  useEffect(() => {
    if (token) {
      fetchCurrentPoll();
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchConfig = async () => {
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

  const saveToken = (value: string) => {
    setToken(value);
    if (value) {
      localStorage.setItem(tokenKey, value);
    } else {
      localStorage.removeItem(tokenKey);
    }
  };

  const fetchMe = async () => {
    setStatus('loading');
    setError(null);
    setMe(null);
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: MeResponse = await res.json();
      setMe(data);
      setStatus('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  const fetchCurrentPoll = async () => {
    if (!token) return;
    setPollError(null);
    try {
      const res = await fetch('/api/polls/current', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 204) {
        setPoll(null);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: PollResponse = await res.json();
      setPoll(data);
      await fetchEntries(data.id);
      await fetchVote(data.id);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to load poll');
    }
  };

  const fetchHistory = async () => {
    if (!token) return;
    setHistoryError(null);
    try {
      const res = await fetch('/api/polls/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
    }
  };

  const fetchEntries = async (pollId?: string) => {
    if (!token || !(pollId ?? poll?.id)) return;
    const targetId = pollId ?? poll?.id;
    setEntriesError(null);
    setEntriesLoading(true);
    try {
      const res = await fetch(`/api/polls/${targetId}/entries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  const submitEntry = async () => {
    if (!poll) return;
    setEntrySubmitError(null);
    setEntrySubmitting(true);
    try {
      const ensureAsset = async (explicitId: string, file?: File) => {
        if (explicitId) return explicitId;
        if (!file) throw new Error('Provide an asset file or ID');
        const upload = await uploadAsset(file);
        return upload.id;
      };

      const originalId = await ensureAsset(entryForm.originalAssetId, entryFiles.original);
      const teaserId = entryForm.teaserAssetId || (entryFiles.teaser ? (await uploadAsset(entryFiles.teaser)).id : '');
      const publicId = entryForm.publicAssetId || (entryFiles.public ? (await uploadAsset(entryFiles.public)).id : '');

      const res = await fetch(`/api/polls/${poll.id}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: entryForm.displayName.trim(),
          description: entryForm.description.trim() || undefined,
          originalAssetId: originalId,
          teaserAssetId: teaserId || undefined,
          publicAssetId: publicId || undefined
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await fetchEntries(poll.id);
      setEntryForm({ displayName: '', description: '', originalAssetId: '', teaserAssetId: '', publicAssetId: '' });
      setEntryFiles({});
    } catch (err) {
      setEntrySubmitError(err instanceof Error ? err.message : 'Failed to submit entry');
    } finally {
      setEntrySubmitting(false);
    }
  };

  const uploadAsset = async (file: File): Promise<AssetUploadResponse> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json();
  };

  const loadAsset = async (id?: string) => {
    if (!id || assetCache[id]) return;
    try {
      const res = await fetch(`/api/assets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data: AssetUploadResponse = await res.json();
      setAssetCache((prev) => ({ ...prev, [id]: data }));
    } catch {
      // Ignore
    }
  };

  const loadAssetsForEntries = (data: PollEntryResponse[]) => {
    const ids = new Set<string>();
    data.forEach((e) => {
      if (e.publicAssetId) ids.add(e.publicAssetId);
      else if (e.teaserAssetId) ids.add(e.teaserAssetId);
      else if (e.originalAssetId) ids.add(e.originalAssetId);
    });
    ids.forEach((id) => loadAsset(id));
  };

  const fetchVote = async (pollId?: string) => {
    if (!token || !(pollId ?? poll?.id)) return;
    const targetId = pollId ?? poll?.id;
    try {
      const res = await fetch(`/api/polls/${targetId}/vote`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    } catch (_err) {
      // Keep silent failure to avoid blocking UI; show message inline if needed.
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

  const submitVote = async () => {
    if (!poll) return;
    setVoteError(null);
    setVoteSubmitting(true);

    const selected = Object.entries(voteState)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => ({ entryId: id, rank: v.rank }));

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
      const ranks = selected.map((s) => Number(s.rank));
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
    } else if (selected.some((s) => s.rank)) {
      setVoteError('Do not supply ranks for this poll');
      setVoteSubmitting(false);
      return;
    }

    const payload = {
      choices: selected.map((s) => ({ entryId: s.entryId, rank: s.rank ? Number(s.rank) : undefined }))
    };

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: VoteResponse = await res.json();
      setVoteInfo(data);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setVoteSubmitting(false);
    }
  };

  const createPoll = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          submissionOpensAt: createForm.submissionOpensAt,
          submissionClosesAt: createForm.submissionClosesAt,
          votingOpensAt: createForm.votingOpensAt,
          votingClosesAt: createForm.votingClosesAt,
          hideEntriesUntilVoting: createForm.hideEntriesUntilVoting,
          maxSelections: createForm.maxSelections,
          requireRanking: createForm.votingMethod === 2,
          maxSubmissionsPerMember: createForm.maxSubmissionsPerMember,
          votingMethod: createForm.votingMethod
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: PollResponse = await res.json();
      setPoll(data);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const transitionPoll = async (path: string) => {
    if (!poll) return;
    try {
      const res = await fetch(`/api/polls/${poll.id}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data: PollResponse = await res.json();
      setPoll(data);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to update poll');
    }
  };

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">OpenVoting</p>
          <h1>Discord login + API check</h1>
          <p className="lede">Paste a JWT (or complete the Discord OAuth) and hit “Check my account”.</p>
          {configError && <p className="error">Config error: {configError}</p>}
        </div>
        {config?.discordAuthorizeUrl && (
          <a className="btn primary" href={config.discordAuthorizeUrl}>Start Discord login</a>
        )}
      </header>

      <section className="card">
        <label htmlFor="token">JWT token</label>
        <textarea
          id="token"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          placeholder="Paste the JWT returned by POST /api/auth/discord"
          rows={4}
        />
        <div className="actions">
          <button className="btn" onClick={() => saveToken('')}>Clear</button>
          <button className="btn primary" onClick={fetchMe} disabled={!token || status === 'loading'}>
            {status === 'loading' ? 'Checking…' : 'Check my account'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {status === 'ok' && me && (
          <div className="result">
            <p><strong>Name:</strong> {me.displayName}</p>
            <p><strong>Member ID:</strong> {me.memberId}</p>
            <p><strong>Community:</strong> {me.communityId}</p>
            <p><strong>Joined:</strong> {new Date(me.joinedAt).toLocaleString()}</p>
            <p><strong>Admin:</strong> {me.isAdmin ? 'Yes' : 'No'}</p>
            <p className={me.isEligible ? 'ok' : 'error'}>
              <strong>Eligible:</strong> {me.isEligible ? 'Yes' : me.ineligibleReason ?? 'No'}
            </p>
          </div>
        )}
      </section>

      {token && (
        <section className="card">
          <div className="section-head">
            <h2>Current poll</h2>
            <button className="btn" onClick={fetchCurrentPoll}>Refresh</button>
          </div>
          {pollError && <p className="error">{pollError}</p>}
          {!poll && <p>No active poll.</p>}
          {poll && (
            <div className="result">
              <p><strong>Title:</strong> {poll.title}</p>
              <p><strong>Status:</strong> {PollStatusLabel(poll.status)}</p>
              <p><strong>Method:</strong> {VotingMethodLabel(poll.votingMethod)}</p>
              <p><strong>Submissions:</strong> {new Date(poll.submissionOpensAt).toLocaleString()} → {new Date(poll.submissionClosesAt).toLocaleString()}</p>
              <p><strong>Voting:</strong> {new Date(poll.votingOpensAt).toLocaleString()} → {new Date(poll.votingClosesAt).toLocaleString()}</p>
              {poll.mustHaveJoinedBefore && <p><strong>Join cutoff:</strong> {new Date(poll.mustHaveJoinedBefore).toLocaleString()}</p>}
              {poll.requiredRoleIds.length > 0 && <p><strong>Required roles:</strong> {poll.requiredRoleIds.join(', ')}</p>}
              <p><strong>Can submit:</strong> {poll.canSubmit ? 'Yes' : 'No'}</p>
              <p><strong>Can vote:</strong> {poll.canVote ? 'Yes' : 'No'}</p>
              {me?.isAdmin && poll.isAdmin && (
                <div className="actions">
                  {poll.status === 0 && <button className="btn primary" onClick={() => transitionPoll('open-submissions')}>Open submissions</button>}
                  {poll.status === 1 && <button className="btn primary" onClick={() => transitionPoll('open-voting')}>Open voting</button>}
                  {poll.status === 2 && <button className="btn" onClick={() => transitionPoll('close')}>Close poll</button>}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {poll && (
        <section className="card">
          <div className="section-head">
            <h2>Entries</h2>
            <button className="btn" onClick={() => fetchEntries()}>Refresh entries</button>
          </div>
          {entriesError && <p className="error">{entriesError}</p>}
          {entriesLoading && <p>Loading entries…</p>}
          {!entriesLoading && entries !== null && entries.length === 0 && <p>No entries visible.</p>}
          {!entriesLoading && entries && entries.length > 0 && (
            <ul className="entries">
              {entries.map((e) => (
                <li key={e.id}>
                  <div className="entry-head">
                    <strong>{e.displayName}</strong>
                    <span className="muted">{shortId(e.id)}</span>
                  </div>
                  {e.description && <p>{e.description}</p>}
                  {assetCache[e.publicAssetId ?? e.teaserAssetId ?? e.originalAssetId ?? '']?.url && (
                    <img
                      src={assetCache[e.publicAssetId ?? e.teaserAssetId ?? e.originalAssetId ?? '']!.url}
                      alt={e.displayName}
                      className="entry-img"
                    />
                  )}
                  <p className="muted">Original asset: {shortId(e.originalAssetId)}</p>
                  {e.isDisqualified && <p className="error">Disqualified: {e.disqualificationReason ?? 'No reason provided'}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {me?.isAdmin && (
        <section className="card">
          <h2>Create poll (admin)</h2>
          <div className="form-grid">
            <label>Title
              <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
            </label>
            <label>Description
              <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </label>
            <label>Submission opens
              <input type="datetime-local" value={toLocal(createForm.submissionOpensAt)} onChange={(e) => setCreateForm({ ...createForm, submissionOpensAt: fromLocal(e.target.value) })} />
            </label>
            <label>Submission closes
              <input type="datetime-local" value={toLocal(createForm.submissionClosesAt)} onChange={(e) => setCreateForm({ ...createForm, submissionClosesAt: fromLocal(e.target.value) })} />
            </label>
            <label>Voting opens
              <input type="datetime-local" value={toLocal(createForm.votingOpensAt)} onChange={(e) => setCreateForm({ ...createForm, votingOpensAt: fromLocal(e.target.value) })} />
            </label>
            <label>Voting closes
              <input type="datetime-local" value={toLocal(createForm.votingClosesAt)} onChange={(e) => setCreateForm({ ...createForm, votingClosesAt: fromLocal(e.target.value) })} />
            </label>
            <label>Max selections
              <input type="number" min={1} value={createForm.maxSelections} onChange={(e) => setCreateForm({ ...createForm, maxSelections: Number(e.target.value) })} />
            </label>
            <label>Max submissions per member
              <input type="number" min={1} value={createForm.maxSubmissionsPerMember} onChange={(e) => setCreateForm({ ...createForm, maxSubmissionsPerMember: Number(e.target.value) })} />
            </label>
            <label>
              <input type="checkbox" checked={createForm.hideEntriesUntilVoting} onChange={(e) => setCreateForm({ ...createForm, hideEntriesUntilVoting: e.target.checked })} /> Hide entries until voting
            </label>
            <label>Voting method
              <select
                value={createForm.votingMethod}
                onChange={(e) => {
                  const nextMethod = Number(e.target.value);
                  setCreateForm({
                    ...createForm,
                    votingMethod: nextMethod,
                    requireRanking: nextMethod === 2
                  });
                }}
              >
                <option value={1}>Approval</option>
                <option value={2}>Instant Runoff (IRV)</option>
              </select>
            </label>
            <label>
              <input type="checkbox" checked={createForm.votingMethod === 2} disabled /> Ranking required for IRV
            </label>
          </div>
          {createError && <p className="error">{createError}</p>}
          <div className="actions">
            <button className="btn primary" onClick={createPoll} disabled={creating}>{creating ? 'Creating…' : 'Create poll'}</button>
          </div>
        </section>
      )}

      {poll?.canSubmit && (
        <section className="card">
          <h2>Submit entry</h2>
          <div className="form-grid">
            <label>Display name
              <input value={entryForm.displayName} onChange={(e) => setEntryForm({ ...entryForm, displayName: e.target.value })} />
            </label>
            <label>Description
              <input value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} />
            </label>
            <label>Original asset ID
              <input value={entryForm.originalAssetId} onChange={(e) => setEntryForm({ ...entryForm, originalAssetId: e.target.value })} />
            </label>
            <label>Or upload original asset
              <input type="file" onChange={(e) => setEntryFiles({ ...entryFiles, original: e.target.files?.[0] ?? undefined })} />
            </label>
            <label>Teaser asset ID (optional)
              <input value={entryForm.teaserAssetId} onChange={(e) => setEntryForm({ ...entryForm, teaserAssetId: e.target.value })} />
            </label>
            <label>Or upload teaser asset
              <input type="file" onChange={(e) => setEntryFiles({ ...entryFiles, teaser: e.target.files?.[0] ?? undefined })} />
            </label>
            <label>Public asset ID (optional)
              <input value={entryForm.publicAssetId} onChange={(e) => setEntryForm({ ...entryForm, publicAssetId: e.target.value })} />
            </label>
            <label>Or upload public asset
              <input type="file" onChange={(e) => setEntryFiles({ ...entryFiles, public: e.target.files?.[0] ?? undefined })} />
            </label>
          </div>
          {entrySubmitError && <p className="error">{entrySubmitError}</p>}
          <div className="actions">
            <button className="btn primary" onClick={submitEntry} disabled={entrySubmitting}>{entrySubmitting ? 'Submitting…' : 'Submit entry'}</button>
          </div>
        </section>
      )}

      {poll?.canVote && entries && entries.length > 0 && (
        <section className="card">
          <h2>Vote</h2>
          <p className="lede">Select up to {poll.maxSelections} entries{poll.requireRanking ? ' and provide unique ranks starting at 1.' : '.'}</p>
          {voteError && <p className="error">{voteError}</p>}
          <div className="entries vote-list">
            {entries.map((e) => {
              const current = voteState[e.id] ?? { selected: false, rank: '' };
              const asset = assetCache[e.publicAssetId ?? e.teaserAssetId ?? e.originalAssetId ?? ''];
              return (
                <div className="entry-vote" key={e.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={current.selected}
                      onChange={(ev) => toggleSelection(e.id, ev.target.checked)}
                    />
                    <span className="entry-title">{e.displayName}</span>
                    <span className="muted">{shortId(e.id)}</span>
                  </label>
                  {asset?.url && <img src={asset.url} alt={e.displayName} className="entry-img" />}
                  {poll.requireRanking && current.selected && (
                    <input
                      type="number"
                      min={1}
                      max={entries.length}
                      value={current.rank}
                      onChange={(ev) => updateRank(e.id, ev.target.value)}
                      placeholder="Rank"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="actions">
            <button className="btn primary" onClick={submitVote} disabled={voteSubmitting}>{voteSubmitting ? 'Submitting…' : 'Submit vote'}</button>
          </div>
          {voteInfo && (
            <p className="muted">Last submitted: {voteInfo.submittedAt ? new Date(voteInfo.submittedAt).toLocaleString() : 'Pending'}</p>
          )}
        </section>
      )}

      {token && (
        <section className="card">
          <div className="section-head">
            <h2>Past polls</h2>
            <button className="btn" onClick={fetchHistory}>Refresh</button>
          </div>
          {historyError && <p className="error">{historyError}</p>}
          {history.length === 0 && !historyError && <p>No past polls.</p>}
          {history.length > 0 && (
            <ul className="entries">
              {history.map((p) => (
                <li key={p.id}>
                  <div className="entry-head">
                    <strong>{p.title}</strong>
                    <span className="muted">{VotingMethodLabel(p.votingMethod)}</span>
                  </div>
                  <p className="muted">Closed: {new Date(p.votingClosesAt).toLocaleString()}</p>
                  {p.winners.length === 0 && <p>No votes recorded.</p>}
                  {p.winners.length > 0 && (
                    <div>
                      <p className="winner-badge">{WinnerLabel(p.winners.length)}</p>
                      <ul className="winners">
                        {p.winners.map((w) => (
                          <li key={w.entryId} className="winner-chip">
                            <div>
                              <strong>{w.displayName}</strong>
                              <span className="muted"> — {w.votes} vote{w.votes === 1 ? '' : 's'}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function PollStatusLabel(status: number) {
  switch (status) {
    case 0:
      return 'Draft';
    case 1:
      return 'Submissions open';
    case 2:
      return 'Voting open';
    case 3:
      return 'Closed';
    case 4:
      return 'Cancelled';
    default:
      return `Unknown (${status})`;
  }
}

function VotingMethodLabel(method: number) {
  switch (method) {
    case 1:
      return 'Approval';
    case 2:
      return 'Instant Runoff (IRV)';
    default:
      return `Unknown (${method})`;
  }
}

function WinnerLabel(count: number) {
  return count > 1 ? 'Winners (tie)' : 'Winner';
}

function toLocal(iso: string) {
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocal(local: string) {
  return new Date(local).toISOString();
}

function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}
