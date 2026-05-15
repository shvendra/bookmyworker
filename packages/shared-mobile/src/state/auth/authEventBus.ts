// Thin event bus so apiClient can trigger a sign-out without importing AuthContext
// (which would create a circular dependency).

type Handler = () => void;
let _handler: Handler | null = null;

export const registerSignOutHandler = (handler: Handler): void => {
  _handler = handler;
};

export const unregisterSignOutHandler = (): void => {
  _handler = null;
};

/** Called by apiClient on 401. Triggers the registered signOut callback. */
export const emitForceSignOut = (): void => {
  _handler?.();
};
