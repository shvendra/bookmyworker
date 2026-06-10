// authStorage mock — `getAccessToken` is configurable so tests can exercise
// both the "has token" (Authorization header) and "no token" branches.
export const getAccessToken = jest.fn(async (): Promise<string | null> => 'test-token');
