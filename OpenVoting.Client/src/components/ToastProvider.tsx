import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'info' | 'success' | 'error';

type ToastOptions = {
  tone?: ToastTone;
  durationMs?: number;
};

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  isExiting: boolean;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const EXIT_ANIMATION_MS = 220;
const DUPLICATE_SUPPRESSION_MS = 600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToastRef = useRef<{ message: string; tone: ToastTone; timestamp: number } | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((toast) => toast.id === id ? { ...toast, isExiting: true } : toast));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, EXIT_ANIMATION_MS);
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const tone: ToastTone = options?.tone ?? 'info';
    const duration = options?.durationMs ?? 4500;

    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.message === message && last.tone === tone && now - last.timestamp < DUPLICATE_SUPPRESSION_MS) {
      return;
    }
    lastToastRef.current = { message, tone, timestamp: now };

    setToasts((prev) => [...prev, { id, message, tone, isExiting: false }]);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.tone}${toast.isExiting ? ' leaving' : ''}`}
            role="alert"
            onClick={() => dismiss(toast.id)}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
