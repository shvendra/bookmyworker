// Global test setup — runs before every test file

// React Native globals
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// Suppress console.error noise from expected error paths
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('Warning:') || msg.includes('act(')) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
