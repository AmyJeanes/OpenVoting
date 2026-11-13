// UI events cannot await, so an action passed through here must report its own errors, e.g. in state or a toast
export function toEventHandler<Args extends unknown[]>(action: (...args: Args) => Promise<unknown>) {
  return (...args: Args) => {
    void action(...args);
  };
}
