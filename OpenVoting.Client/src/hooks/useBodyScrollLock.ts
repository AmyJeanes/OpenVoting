import { useEffect } from 'react';

let lockCount = 0;
let lockScrollY = 0;
let previousHtmlOverflow = '';
let previousBodyPosition = '';
let previousBodyTop = '';
let previousBodyLeft = '';
let previousBodyRight = '';
let previousBodyWidth = '';
let previousBodyPaddingRight = '';

function lockBodyScroll() {
  if (typeof document === 'undefined') return;

  if (lockCount === 0) {
    const html = document.documentElement;
    const body = document.body;

    lockScrollY = window.scrollY;
    previousHtmlOverflow = html.style.overflow;
    previousBodyPosition = body.style.position;
    previousBodyTop = body.style.top;
    previousBodyLeft = body.style.left;
    previousBodyRight = body.style.right;
    previousBodyWidth = body.style.width;
    previousBodyPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - html.clientWidth;
    if (scrollbarWidth > 0) {
      const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }

    html.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${lockScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }

  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;

  lockCount -= 1;

  if (lockCount > 0) return;

  const html = document.documentElement;
  const body = document.body;

  html.style.overflow = previousHtmlOverflow;
  body.style.position = previousBodyPosition;
  body.style.top = previousBodyTop;
  body.style.left = previousBodyLeft;
  body.style.right = previousBodyRight;
  body.style.width = previousBodyWidth;
  body.style.paddingRight = previousBodyPaddingRight;

  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return;
  }

  try {
    window.scrollTo(0, lockScrollY);
  } catch {
    return;
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [active]);
}
