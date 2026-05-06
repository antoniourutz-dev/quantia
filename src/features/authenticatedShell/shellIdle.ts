export type IdleHandle = number | ReturnType<typeof setTimeout>;

type WindowWithIdleCallbacks = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export const requestIdle = (callback: () => void, timeoutMs = 1200): IdleHandle => {
  if (typeof window === 'undefined') return setTimeout(callback, 0);
  const idle = (window as WindowWithIdleCallbacks).requestIdleCallback;
  if (typeof idle === 'function') {
    return idle(callback, { timeout: timeoutMs });
  }
  return window.setTimeout(callback, 0);
};

export const cancelIdle = (handle: IdleHandle | null | undefined) => {
  if (handle == null) return;
  if (typeof window === 'undefined') {
    clearTimeout(handle);
    return;
  }
  const cancel = (window as WindowWithIdleCallbacks).cancelIdleCallback;
  if (typeof cancel === 'function' && typeof handle === 'number') {
    cancel(handle);
    return;
  }
  window.clearTimeout(handle);
};
