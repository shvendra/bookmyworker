import { describeLoadError, firstQueryError } from '../../shared/utils/describeLoadError';

const t = (key: string) => key; // identity translator — assert on the key chosen

describe('describeLoadError', () => {
  it('no error → empty string', () => {
    expect(describeLoadError(undefined, t)).toBe('');
    expect(describeLoadError(null, t)).toBe('');
  });

  it('no statusCode (timeout / offline) → network message', () => {
    expect(describeLoadError({ message: 'Request timed out.' }, t)).toBe('dashboardLoadErrorNet');
    expect(describeLoadError(new Error('Network Error'), t)).toBe('dashboardLoadErrorNet');
  });

  it('5xx → server-busy message', () => {
    expect(describeLoadError({ statusCode: 500, message: 'x' }, t)).toBe('dashboardLoadErrorServer');
    expect(describeLoadError({ statusCode: 503 }, t)).toBe('dashboardLoadErrorServer');
  });

  it('401 → session-expired message', () => {
    expect(describeLoadError({ statusCode: 401 }, t)).toBe('dashboardLoadErrorAuth');
  });

  it('other 4xx → the server-provided message verbatim', () => {
    expect(describeLoadError({ statusCode: 400, message: 'Invalid district filter' }, t)).toBe('Invalid district filter');
  });
});

describe('firstQueryError', () => {
  it('returns the first errored query’s error, skipping nulls and non-errored', () => {
    const err = { statusCode: 500 };
    expect(
      firstQueryError([null, { isError: false, error: 'nope' }, undefined, { isError: true, error: err }]),
    ).toBe(err);
  });

  it('returns undefined when nothing errored', () => {
    expect(firstQueryError([null, { isError: false }, undefined])).toBeUndefined();
  });
});
