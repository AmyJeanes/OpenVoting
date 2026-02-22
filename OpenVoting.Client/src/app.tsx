/// <reference types="w3c-web-usb" />
import { Navigate, Route, Routes } from 'react-router-dom';
import './app.css';
import {
  ActivePollsPage,
  CurrentPollPage,
  HistoryPage,
  NotFound,
  PageShell,
  Topbar,
  ConfirmDialog,
  DiscordLinkPage,
  DiscordOAuthCallbackPage,
  votingMethodOptions
} from './components';
import { useVotingApp } from './hooks/useVotingApp';

export default function App() {
  const app = useVotingApp();

  const {
    sessionState,
    me,
    config,
    configError,
    flash,
    loginCta,
    handleLogin,
    logout,
    isBootstrapping,
    hasLivePolls,
    // poll data
    poll,
    pollError,
    pollDetail,
    pollLoading,
    activePolls,
    activeLoading,
    refreshActiveAndSelected,
    handleSelectPoll,
    transitionPoll,
    deletePoll,
    updatePollMetadata,
    updateSubmissionSettings,
    updateVotingSettings,
    // entries
    entries,
    entriesError,
    entriesLoading,
    entryForm,
    setEntryForm,
    entryFiles,
    entryFileValidationPending,
    entryFileInvalid,
    entrySubmitError,
    entrySubmitSuccessCount,
    entrySubmitting,
    submitEntry,
    handleEntryFilesChange,
    disqualifyEntry,
    requalifyEntry,
    deleteEntry,
    assetCache,
    // voting
    voteState,
    voteError,
    voteSubmitting,
    voteInfo,
    toggleSelection,
    updateRank,
    submitVote,
    votingBreakdown,
    votingBreakdownError,
    // creation
    createForm,
    setCreateForm,
    creating,
    createError,
    createSuccessCount,
    createPoll,
    // history
    history,
    historyError,
    fetchHistory,
    // modals
    openVotingModal,
    setOpenVotingModal,
    handleConfirmOpenVoting,
    handleCancelOpenVoting,
    confirmConfig,
    settleConfirm
  } = app;

  const loginDisabled = !config?.discordAuthorizeUrl;

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
          <h2>Please wait…</h2>
        </section>
      ) : (
      <Routes>
        <Route path="/" element={<Navigate to="/polls/live" replace />} />
        <Route path="/auth/discord-link" element={<DiscordLinkPage />} />
        <Route path="/auth/discord-callback" element={<DiscordOAuthCallbackPage />} />
        <Route
          path="/polls/live"
          element={
            <ActivePollsPage
              sessionState={sessionState}
              me={me}
              onLogin={handleLogin}
              loginCta={loginCta}
              loginDisabled={loginDisabled}
              activePolls={activePolls}
              pollError={pollError}
              loading={activeLoading}
              onRefresh={refreshActiveAndSelected}
              createForm={createForm}
              setCreateForm={setCreateForm}
              creating={creating}
              createError={createError}
              createSuccessCount={createSuccessCount}
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
              onLogin={handleLogin}
              loginCta={loginCta}
              loginDisabled={loginDisabled}
              poll={poll}
              pollError={pollError}
              pollDetail={pollDetail}
              pollLoading={pollLoading}
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
              entryFileValidationPending={entryFileValidationPending}
              entryFileInvalid={entryFileInvalid}
              entrySubmitError={entrySubmitError}
              entrySubmitSuccessCount={entrySubmitSuccessCount}
              entrySubmitting={entrySubmitting}
              assetCache={assetCache}
              onRefreshPoll={refreshActiveAndSelected}
              onSelectPoll={handleSelectPoll}
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
            />
          }
        />
        <Route
          path="/polls/:pollId"
          element={
            <CurrentPollPage
              sessionState={sessionState}
              me={me}
              onLogin={handleLogin}
              loginCta={loginCta}
              loginDisabled={loginDisabled}
              poll={poll}
              pollError={pollError}
              pollDetail={pollDetail}
              pollLoading={pollLoading}
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
              entryFileValidationPending={entryFileValidationPending}
              entryFileInvalid={entryFileInvalid}
              entrySubmitError={entrySubmitError}
              entrySubmitSuccessCount={entrySubmitSuccessCount}
              entrySubmitting={entrySubmitting}
              assetCache={assetCache}
              onRefreshPoll={refreshActiveAndSelected}
              onSelectPoll={handleSelectPoll}
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
            />
          }
        />
        <Route
          path="/polls/history"
          element={
            <HistoryPage
              sessionState={sessionState}
              onLogin={handleLogin}
              loginCta={loginCta}
              loginDisabled={loginDisabled}
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
            <p className="muted">Choose the voting method to use. This cannot be changed after voting starts</p>
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
            <p className="muted">Voting method cannot be modified after the vote has started</p>
          </div>
        </div>
      )}
      <ConfirmDialog config={confirmConfig} onConfirm={() => settleConfirm(true)} onCancel={() => settleConfirm(false)} />
    </PageShell>
  );
}
