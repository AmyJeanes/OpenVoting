export type VotingMethodOption = {
  id: number;
  name: string;
  short: string;
  summary: string;
  steps: string[];
};

export const votingMethodOptions: VotingMethodOption[] = [
  {
    id: 1,
    name: 'Approval voting',
    short: 'Approval',
    summary: 'Voters can approve as many entries as they like. The entries with the most approvals win',
    steps: [
      'Voters pick any entries they support (up to the max selections setting)',
      'Each selected entry gets one approval vote',
      'Entries are ranked by total approvals to decide winners'
    ]
  },
  {
    id: 2,
    name: 'Instant Runoff (IRV)',
    short: 'Instant Runoff (IRV)',
    summary: 'Voters rank choices. The lowest-ranked entries are eliminated and votes transfer until a winner remains',
    steps: [
      'Voters rank their chosen entries in order of preference',
      'In each round the lowest-ranked entry is eliminated',
      'Votes for eliminated entries transfer to the next ranked choice until a winner emerges'
    ]
  }
];

export const votingMethodOptionById = (id: number) => votingMethodOptions.find((opt) => opt.id === id) ?? votingMethodOptions[0];

export function votingMethodSummary(id: number) {
  return votingMethodOptionById(id).summary;
}
