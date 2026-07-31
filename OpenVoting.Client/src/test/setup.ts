import '@testing-library/jest-dom/vitest';

// jsdom omits AnimationEvent, so React's vendor-prefix probe settles on
// webkitAnimationEnd and onAnimationEnd never fires for a dispatched animationend.
const domWindow = window as unknown as { AnimationEvent?: typeof AnimationEvent };

if (!domWindow.AnimationEvent) {
  class JsdomAnimationEvent extends Event {
    readonly animationName: string;
    readonly elapsedTime: number;
    readonly pseudoElement: string;

    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init);
      this.animationName = init.animationName ?? '';
      this.elapsedTime = init.elapsedTime ?? 0;
      this.pseudoElement = init.pseudoElement ?? '';
    }
  }

  domWindow.AnimationEvent = JsdomAnimationEvent;
}
