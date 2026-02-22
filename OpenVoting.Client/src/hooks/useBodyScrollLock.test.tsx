import { render } from '@testing-library/react';
import { useBodyScrollLock } from './useBodyScrollLock';

function ScrollLockProbe({ active }: { active: boolean }) {
  useBodyScrollLock(active);
  return null;
}

describe('useBodyScrollLock', () => {
  beforeEach(() => {
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
  });

  afterEach(() => {
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
  });

  it('locks and unlocks scroll when active toggles', () => {
    const { rerender } = render(<ScrollLockProbe active />);

    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');

    rerender(<ScrollLockProbe active={false} />);

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
  });

  it('keeps scroll locked until all active locks are released', () => {
    const first = render(<ScrollLockProbe active />);
    const second = render(<ScrollLockProbe active />);

    expect(document.documentElement.style.overflow).toBe('hidden');

    first.unmount();
    expect(document.documentElement.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});
