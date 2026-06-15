// authService mock — methods used by the agent register flow.
export const authService = {
  requestOtp: jest.fn().mockResolvedValue(undefined),
  googleStart: jest.fn().mockResolvedValue({ loggedIn: false }),
  // Used by the no-OTP (registration OTP disabled) direct-register path.
  register: jest.fn().mockResolvedValue(undefined),
  loginWithPassword: jest.fn().mockResolvedValue({
    user: { role: 'agent', id: 'u1' },
    onboardingCompleted: true,
  }),
};
