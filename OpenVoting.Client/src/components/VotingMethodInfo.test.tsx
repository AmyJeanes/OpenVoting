import { fireEvent, render, screen } from '@testing-library/react';
import { VotingMethodInfo } from './VotingMethodInfo';

describe('VotingMethodInfo', () => {
  it('keeps popover open while moving pointer from trigger toward popover', () => {
    render(<VotingMethodInfo method={1} />);

    const button = screen.getByRole('button', { name: /what is/i });
    const root = button.closest('.method-info');
    expect(root).not.toBeNull();

    fireEvent.pointerEnter(root as HTMLElement, { pointerType: 'mouse' });

    const popover = screen.getByRole('dialog');
    expect(popover).toBeInTheDocument();

    fireEvent.pointerLeave(root as HTMLElement, { pointerType: 'mouse', relatedTarget: popover });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.pointerLeave(root as HTMLElement, { pointerType: 'mouse', relatedTarget: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still supports click to toggle popover', () => {
    render(<VotingMethodInfo method={2} />);

    const button = screen.getByRole('button', { name: /what is/i });

    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on touch tap inside the tooltip region', () => {
    render(<VotingMethodInfo method={2} />);

    const button = screen.getByRole('button', { name: /what is/i });
    fireEvent.click(button);
    const popover = screen.getByRole('dialog');

    fireEvent.pointerDown(popover, { pointerType: 'touch' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
