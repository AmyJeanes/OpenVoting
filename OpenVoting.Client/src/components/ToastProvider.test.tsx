import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastProvider';

describe('ToastProvider', () => {
  it('shows and auto-dismisses a toast', async () => {
    const Trigger = () => {
      const { showToast } = useToast();
      useEffect(() => {
        showToast('Auto message', { tone: 'info', durationMs: 50 });
      }, [showToast]);
      return <button onClick={() => showToast('Clicked', { durationMs: 50 })}>Trigger</button>;
    };

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    // initial effect toast
    expect(await screen.findByText('Auto message')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Auto message')).not.toBeInTheDocument();
      expect(screen.queryByText('Clicked')).not.toBeInTheDocument();
    }, { timeout: 500 });
  });
});
