import { render, screen } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('shows jump to top only after scrolling and scrolls to top on click', async () => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(
      <PageShell topbar={<div>Top</div>} flash={null} configError={null}>
        <div>Body</div>
      </PageShell>
    );

    expect(screen.queryByRole('button', { name: 'Jump to top' })).not.toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 20,
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    const jumpButton = screen.getByRole('button', { name: 'Jump to top' });
    expect(jumpButton).toBeInTheDocument();

    await userEvent.click(jumpButton);

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    scrollToSpy.mockRestore();
  });
});
