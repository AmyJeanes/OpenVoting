import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageLightbox } from './ImageLightbox';

describe('ImageLightbox', () => {
  it('closes on Escape key and backdrop click', async () => {
    const onClose = vi.fn();

    render(<ImageLightbox imageUrl="/preview.jpg" alt="Preview image" onClose={onClose} />);

    expect(screen.getByRole('img', { name: 'Preview image' })).toHaveAttribute('src', '/preview.jpg');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
    act(() => {
      screen.getByRole('dialog').dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('dialog'));
    act(() => {
      screen.getByRole('dialog').dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });

  it('renders without original link', () => {
    const onClose = vi.fn();
    render(<ImageLightbox imageUrl="/preview.jpg" alt="Only preview" onClose={onClose} />);

    expect(screen.getByRole('img', { name: 'Only preview' })).toBeInTheDocument();
  });
});
