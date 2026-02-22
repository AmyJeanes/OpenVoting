import { useEffect, useRef, useState } from 'react';
import { votingMethodOptionById } from './votingMethodOptions';

export function VotingMethodInfo({ method }: { method: number }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const option = votingMethodOptionById(method);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const handlePointerEnter = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse') return;
    setOpen(true);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse') return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) {
      return;
    }
    setOpen(false);
  };

  const handlePointerDownCapture = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!open || event.pointerType === 'mouse') return;
    setOpen(false);
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <span
      ref={rootRef}
      className={`method-info${open ? ' open' : ''}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDownCapture={handlePointerDownCapture}
    >
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
