export type MeResponse = {
  memberId: string;
  communityId: string;
  displayName: string;
  joinedAt: string;
  isEligible: boolean;
  ineligibleReason?: string;
  isAdmin: boolean;
};

export type FieldRequirement = 0 | 1 | 2; // Off, Optional, Required

export type CreatePollForm = {
  title: string;
  description: string;
  votingMethod: number;
};

export type PollResponse = {
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
  titleRequirement: FieldRequirement;
  descriptionRequirement: FieldRequirement;
  imageRequirement: FieldRequirement;
  canSubmit: boolean;
  canVote: boolean;
  isAdmin: boolean;
};

export type PollWinnerResponse = {
  entryId: string;
  displayName: string;
  votes: number;
  assetId?: string;
  submittedByDisplayName?: string;
};

export type PollDetailRankCount = {
  rank: number;
  votes: number;
};

export type PollDetailEntryResponse = {
  id: string;
  displayName: string;
  description?: string;
  originalAssetId?: string;
  teaserAssetId?: string;
  publicAssetId?: string;
  isDisqualified: boolean;
  disqualificationReason?: string;
  createdAt: string;
  approvalVotes: number;
  rankCounts: PollDetailRankCount[];
  isWinner: boolean;
  position?: number;
  submittedByDisplayName: string;
};

export type PollDetailResponse = {
  id: string;
  title: string;
  description: string;
  status: number;
  votingMethod: number;
  submissionOpensAt: string;
  submissionClosesAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
  hideEntriesUntilVoting: boolean;
  maxSelections: number;
  requireRanking: boolean;
  titleRequirement: FieldRequirement;
  descriptionRequirement: FieldRequirement;
  imageRequirement: FieldRequirement;
  winners: PollWinnerResponse[];
  entries: PollDetailEntryResponse[];
};

export type VotingBreakdownEntry = {
  entryId: string;
  displayName: string;
  approvals: number;
  rankCounts: PollDetailRankCount[];
};

export type PollHistoryResponse = {
  id: string;
  title: string;
  status: number;
  votingMethod: number;
  votingClosesAt: string;
  winners: PollWinnerResponse[];
};

export type PollEntryResponse = {
  id: string;
  displayName: string;
  description?: string;
  originalAssetId?: string;
  teaserAssetId?: string;
  publicAssetId?: string;
  isDisqualified: boolean;
  disqualificationReason?: string;
  createdAt: string;
  submittedByDisplayName: string;
  isOwn: boolean;
};

export type VoteChoiceResponse = {
  entryId: string;
  rank?: number;
};

export type VoteResponse = {
  voteId: string;
  pollId: string;
  memberId: string;
  isFinal: boolean;
  submittedAt?: string;
  choices: VoteChoiceResponse[];
};

export type AssetUploadResponse = {
  id: string;
  storageKey: string;
  contentType: string;
  bytes: number;
  sha256: string;
  url?: string;
};

export type ConfigResponse = {
  discordAuthorizeUrl: string;
  redirectUri: string;
  serverName: string;
  serverIconUrl?: string;
};

export type SessionState = 'idle' | 'loading' | 'authenticated' | 'anonymous';
