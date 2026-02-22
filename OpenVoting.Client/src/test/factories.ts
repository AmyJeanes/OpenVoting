import type {
  AssetUploadResponse,
  ConfigResponse,
  MeResponse,
  PollEntryResponse,
  PollResponse,
  VoteResponse
} from '../types';

const iso = () => new Date('2024-01-01T00:00:00.000Z').toISOString();

export function createPollResponse(overrides: Partial<PollResponse> = {}): PollResponse {
  return {
    id: 'poll-1',
    title: 'Sample Poll',
    description: 'Description',
    status: 1,
    votingMethod: 1,
    submissionOpensAt: iso(),
    submissionClosesAt: iso(),
    votingOpensAt: iso(),
    votingClosesAt: iso(),
    hideEntriesUntilVoting: false,
    maxSelections: 2,
    requireRanking: false,
    maxSubmissionsPerMember: 2,
    mustHaveJoinedBefore: undefined,
    requiredRoleIds: [],
    titleRequirement: 1,
    descriptionRequirement: 1,
    imageRequirement: 1,
    canSubmit: true,
    canVote: true,
    isAdmin: false,
    ...overrides
  };
}

export function createEntryResponse(overrides: Partial<PollEntryResponse> = {}): PollEntryResponse {
  return {
    id: 'entry-1',
    displayName: 'Entry One',
    description: 'Entry description',
    originalAssetId: undefined,
    publicAssetId: undefined,
    isDisqualified: false,
    disqualificationReason: undefined,
    createdAt: iso(),
    submittedByDisplayName: 'Alice',
    isOwn: false,
    ...overrides
  };
}

export function createAsset(overrides: Partial<AssetUploadResponse> = {}): AssetUploadResponse {
  return {
    id: 'asset-1',
    storageKey: 'assets/asset-1',
    contentType: 'image/png',
    bytes: 1234,
    sha256: 'hash',
    url: 'https://cdn.example.com/asset.png',
    ...overrides
  };
}

export function createVoteResponse(overrides: Partial<VoteResponse> = {}): VoteResponse {
  return {
    voteId: 'vote-1',
    pollId: 'poll-1',
    memberId: 'member-1',
    isFinal: false,
    submittedAt: iso(),
    choices: [],
    ...overrides
  };
}

export function createConfigResponse(overrides: Partial<ConfigResponse> = {}): ConfigResponse {
  return {
    discordAuthorizeUrl: 'https://discord.example.com/auth',
    serverName: 'Test Server',
    serverIconUrl: undefined,
    ...overrides
  };
}

export function createMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    memberId: 'member-1',
    communityId: 'community-1',
    displayName: 'Tester',
    joinedAt: iso(),
    isEligible: true,
    ineligibleReason: undefined,
    isAdmin: false,
    ...overrides
  };
}
