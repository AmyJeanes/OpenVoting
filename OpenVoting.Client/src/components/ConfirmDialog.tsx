import { useEffect, type ReactNode } from 'react';

export type ConfirmDialogConfig = {
  title: string;
  body?: string;
  content?: ReactNode;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  tone?: 'default' | 'danger';
};

export type ConfirmDialogProps = {
  config: ConfirmDialogConfig | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ config, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    if (!config) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [config, onCancel]);

  if (!config) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card confirm-dialog-card">
        <p className="eyebrow">Confirm</p>
        <h3>{config.title}</h3>
        {config.body && <p className="muted">{config.body}</p>}
        {config.content}
        {config.note && <p className="muted">{config.note}</p>}
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>{config.cancelLabel ?? 'Cancel'}</button>
          <button className={config.tone === 'danger' ? 'primary danger' : 'primary'} onClick={onConfirm} disabled={config.confirmDisabled}>
            {config.confirmLabel ?? 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
