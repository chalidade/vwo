import { type ComponentProps, type ComponentType, type ReactNode, Suspense, lazy } from "react";

const loaders: (() => Promise<unknown>)[] = [];

/** A panel that loads its code the first time it opens, so entering the game downloads only the
 *  hall itself. While it loads, `fallback` shows (nothing by default); the game around it keeps running. */
export function lazyPanel<C extends ComponentType<any>>(load: () => Promise<C>, fallback: ReactNode = null) {
  let loading: Promise<C> | null = null;
  // A failed fetch (offline for a moment) is tried again next time instead of being remembered.
  const get = () =>
    (loading ??= load().catch((e: unknown) => {
      loading = null;
      throw e;
    }));
  loaders.push(get);
  const Lazy = lazy(() => get().then((c) => ({ default: c })));
  return function Panel(props: ComponentProps<C>) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

/** Fetch every panel's code once the browser is idle, so a panel opened later shows at once. */
export function preloadPanels() {
  const run = () => loaders.forEach((l) => void l().catch(() => undefined));
  const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 8000 });
  else setTimeout(run, 4000);
}
