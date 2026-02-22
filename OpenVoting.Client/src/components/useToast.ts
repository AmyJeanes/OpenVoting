import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export type ToastOptions = {
  tone?: ToastTone;
  durationMs?: number;
};

export type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
