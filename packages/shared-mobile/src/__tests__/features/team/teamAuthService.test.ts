jest.mock('../../../core/api/endpoints/teamApi', () => ({ teamApi: { login: jest.fn() } }));
jest.mock('../../../core/api/endpoints/authApi', () => ({ getCurrentUser: jest.fn() }));
jest.mock('../../../core/storage/authStorage', () => ({ saveAuthSession: jest.fn().mockResolvedValue(undefined), clearAuthSession: jest.fn().mockResolvedValue(undefined) }));

import { teamApi } from '../../../core/api/endpoints/teamApi';
import { getCurrentUser } from '../../../core/api/endpoints/authApi';
import { saveAuthSession, clearAuthSession } from '../../../core/storage/authStorage';
import { isTeamMode, setTeamMode } from '../../../core/team/teamMode';
import { loginAsTeamMember } from '../../../features/team/services/teamAuthService';

beforeEach(() => { jest.clearAllMocks(); setTeamMode(false); });

describe('loginAsTeamMember', () => {
  it('stores a team session (token kept, team info attached) and turns team mode on before loading the owner profile', async () => {
    (teamApi.login as jest.Mock).mockResolvedValue({ token: 'TT', company: 'Acme', member: { name: 'Ravi', permissions: ['workers:search'] } });
    (getCurrentUser as jest.Mock).mockImplementation(async () => { expect(isTeamMode()).toBe(true); return { id: 'o1', fullName: 'Acme', role: 'employer', state: 'Bihar' }; });
    const s = await loginAsTeamMember('acme-4k2p', '9876543210', '123456');
    expect(s.team).toEqual({ company: 'Acme', memberName: 'Ravi', permissions: ['workers:search'], slug: 'acme-4k2p' });
    expect(s.tokens.accessToken).toBe('TT');
    expect(s.user.fullName).toBe('Acme');
    expect(saveAuthSession).toHaveBeenCalledWith(expect.objectContaining({ team: expect.any(Object) }));
    expect(isTeamMode()).toBe(true);
  });
  it('a bad OTP leaves nothing behind', async () => {
    (teamApi.login as jest.Mock).mockRejectedValue(new Error('Invalid OTP.'));
    await expect(loginAsTeamMember('acme-4k2p', '9876543210', '000000')).rejects.toThrow('Invalid OTP.');
    expect(saveAuthSession).not.toHaveBeenCalled();
    expect(isTeamMode()).toBe(false);
  });
  it('if the owner profile cannot be loaded the session is wiped and team mode turned off', async () => {
    (teamApi.login as jest.Mock).mockResolvedValue({ token: 'TT', company: 'Acme', member: { name: 'Ravi', permissions: [] } });
    (getCurrentUser as jest.Mock).mockRejectedValue(new Error('403'));
    await expect(loginAsTeamMember('acme-4k2p', '9876543210', '123456')).rejects.toThrow('403');
    expect(clearAuthSession).toHaveBeenCalled();
    expect(isTeamMode()).toBe(false);
  });
});
