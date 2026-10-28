import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({ getAccessToken: jest.fn().mockResolvedValue(null), clearAuthSession: jest.fn() }));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { teamApi, teamLinkUrl } from '../../core/api/endpoints/teamApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => mock.restore());

describe('teamApi', () => {
  it('owner calls hit /employer-team', async () => {
    mock.onGet('/api/v1/employer-team').reply(200, { company: 'Acme', members: [] });
    mock.onPost('/api/v1/employer-team/members').reply(201, { member: { _id: 'm1' } });
    mock.onPut('/api/v1/employer-team/members/m1').reply(200, { member: { _id: 'm1' } });
    mock.onDelete('/api/v1/employer-team/members/m1').reply(200, {});
    mock.onPost('/api/v1/employer-team/members/m1/invite').reply(200, {});
    mock.onPost('/api/v1/employer-team/link/rotate').reply(200, { link: { slug: 'new' } });
    mock.onGet('/api/v1/employer-team/activity').reply(200, { activity: [] });
    expect((await teamApi.getTeam()).company).toBe('Acme');
    expect((await teamApi.addMember({ name: 'Ravi', phone: '9876543210', email: 'ravi@acme.com', permissions: ['workers:search'] })).member._id).toBe('m1');
    await teamApi.updateMember('m1', { status: 'suspended' });
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ status: 'suspended' });
    await teamApi.resendInvite('m1');
    expect(mock.history.post.some((p) => p.url?.endsWith('/members/m1/invite'))).toBe(true);
    await teamApi.removeMember('m1');
    expect((await teamApi.rotateLink()).link.slug).toBe('new');
    expect((await teamApi.getActivity(10)).activity).toEqual([]);
  });
  it('team login is mobile + OTP only, marks itself as the app, and carries no password field', async () => {
    mock.onGet('/api/v1/team-access/public/acme-4k2p').reply(200, { company: 'Acme', active: true });
    mock.onPost('/api/v1/team-access/send-otp').reply(200, { message: 'x' });
    mock.onPost('/api/v1/team-access/login').reply(200, { token: 'T', company: 'Acme', member: { name: 'Ravi', permissions: [] } });
    expect((await teamApi.publicLink('acme-4k2p')).company).toBe('Acme');
    await teamApi.sendOtp('acme-4k2p', '9876543210');
    const r = await teamApi.login('acme-4k2p', '9876543210', '123456');
    expect(r.token).toBe('T');
    const sent = mock.history.post.find((p) => p.url?.endsWith('/login'))!;
    expect(sent.headers?.['X-Team-Client']).toBe('app');
    expect(Object.keys(JSON.parse(sent.data)).sort()).toEqual(['identifier', 'otp', 'slug']);
  });
  it('login accepts an email as the id, and a member can leave', async () => {
    mock.onPost('/api/v1/team-access/send-otp').reply(200, { message: 'x' });
    mock.onPost('/api/v1/team-access/leave').reply(200, { success: true });
    await teamApi.sendOtp('acme-4k2p', 'ravi@acme.com');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ slug: 'acme-4k2p', identifier: 'ravi@acme.com' });
    await teamApi.leave();
    expect(mock.history.post.some((p) => p.url?.endsWith('/team-access/leave'))).toBe(true);
  });
  it('builds the shareable link', () => {
    expect(teamLinkUrl('acme-4k2p')).toBe('https://www.bookmyworkers.com/app/team/acme-4k2p');
  });
});
