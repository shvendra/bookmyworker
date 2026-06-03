// Global safety net for errors that escape React's render phase.
//
// The root <ErrorBoundary> only catches errors thrown during render. Async
// errors — a rejected promise with no .catch, a callback that throws — bypass
// it entirely and otherwise vanish silently. This installs:
//   1. a native uncaught-JS-error handler (RN's ErrorUtils), and
//   2. a web/global unhandledrejection listener,
// so those failures are at least logged (and can later be forwarded to a crash
// reporter such as Sentry from the single `report()` hook below).

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler | undefined;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
}

let installed = false;

/** Single choke point for surfacing errors — swap in a crash reporter here. */
export function logError(scope: string, error: unknown, extra?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(`[globalError:${scope}]`, error, extra ?? '');
}

// Internal alias kept for readability within this module.
const report = logError;

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  // 1) Native uncaught JS errors (Hermes / JSC) via React Native's ErrorUtils.
  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      report('uncaught', error, { isFatal });
      // Preserve default behaviour (dev red-box / production crash reporting).
      previous?.(error, isFatal);
    });
  }

  // 2) Unhandled promise rejections (web + environments that dispatch the event).
  const target = globalThis as unknown as {
    addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  };
  if (typeof target.addEventListener === 'function') {
    target.addEventListener('unhandledrejection', (event: unknown) => {
      const reason = (event as { reason?: unknown })?.reason ?? event;
      report('unhandledRejection', reason);
    });
  }
}
