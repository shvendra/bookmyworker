import { describeLoadError } from '../../shared/utils/describeLoadError';

const t = (k: string) => k;

describe('describeLoadError — expired session', () => {
  it('401 → auth message', () => {
    expect(describeLoadError({ statusCode: 401, message: 'x' }, t)).toBe('dashboardLoadErrorAuth');
  });
  it('legacy 400 "Json Web Token is expired" → auth message, not raw token text', () => {
    expect(describeLoadError({ statusCode: 400, message: 'Json Web Token is expired, Try again!' }, t)).toBe('dashboardLoadErrorAuth');
    expect(describeLoadError({ statusCode: 400, message: 'jwt expired' }, t)).toBe('dashboardLoadErrorAuth');
  });
  it('other 4xx messages still surface as before', () => {
    expect(describeLoadError({ statusCode: 400, message: 'Invalid request' }, t)).toBe('Invalid request');
  });
});
