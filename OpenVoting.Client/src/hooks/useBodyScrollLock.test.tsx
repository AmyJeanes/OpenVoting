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
    document.body.style.paddingRight = '';
  });

  afterEach(() => {
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
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

  it('compensates for scrollbar width to prevent layout shift', () => {
    const originalInnerWidth = window.innerWidth;
    const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });

    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if (this === document.documentElement) {
          return 1184;
        }

        return 0;
      },
    });

    try {
      const { rerender } = render(<ScrollLockProbe active />);
      expect(document.body.style.paddingRight).toBe('16px');

      rerender(<ScrollLockProbe active={false} />);
      expect(document.body.style.paddingRight).toBe('');
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });

      if (originalClientWidthDescriptor) {
        Object.defineProperty(Element.prototype, 'clientWidth', originalClientWidthDescriptor);
      }
    }
  });
});
