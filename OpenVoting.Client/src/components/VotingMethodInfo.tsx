import { useEffect, useState } from 'react';

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
    summary: 'Voters can approve as many entries as they like. The entries with the most approvals win.',
    steps: [
      'Voters pick any entries they support (up to the max selections setting).',
      'Each selected entry gets one approval vote.',
      'Entries are ranked by total approvals to decide winners.'
    ]
  },
  {
    id: 2,
    name: 'Instant Runoff (IRV)',
    short: 'Instant Runoff (IRV)',
    summary: 'Voters rank choices. The lowest-ranked entries are eliminated and votes transfer until a winner remains.',
    steps: [
      'Voters rank their chosen entries in order of preference.',
      'In each round the lowest-ranked entry is eliminated.',
      'Votes for eliminated entries transfer to the next ranked choice until a winner emerges.'
    ]
  }
];

const optionById = (id: number) => votingMethodOptions.find((opt) => opt.id === id) ?? votingMethodOptions[0];

export function votingMethodSummary(id: number) {
  return optionById(id).summary;
}

export function VotingMethodInfo({ method }: { method: number }) {
  const [open, setOpen] = useState(false);
  const option = optionById(method);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <span className="method-info" onMouseLeave={() => setOpen(false)}>
      <button
        className="info-chip"
        type="button"
        aria-label={`What is ${option.name}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="method-popover" role="dialog" aria-label={`${option.name} explanation`}>
          <p className="eyebrow">{option.name}</p>
          <p className="muted">{option.summary}</p>
          <ul>
            {option.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
