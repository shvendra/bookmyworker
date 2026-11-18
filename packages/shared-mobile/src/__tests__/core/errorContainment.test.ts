import { installGlobalErrorHandlers } from '../../core/errors/globalErrorHandler';

describe('global error handler (release behaviour)', () => {
  it('logs an uncaught JS error and downgrades it to NON-fatal so the app keeps running', () => {
    const prev = jest.fn();
    let installed: ((e: unknown, fatal?: boolean) => void) | undefined;
    (globalThis as any).ErrorUtils = {
      getGlobalHandler: () => prev,
      setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => { installed = h; },
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    installGlobalErrorHandlers();
    installed?.(new Error('boom'), true);
    expect(prev).toHaveBeenCalledWith(expect.any(Error), false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
