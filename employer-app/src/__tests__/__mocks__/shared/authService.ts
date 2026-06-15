// authService mock — configurable jest mocks.
export const authService = {
  requestOtp: jest.fn().mockResolvedValue(undefined),
  googleStart: jest.fn().mockResolvedValue({ loggedIn: false }),
  // Used by the no-OTP (registration OTP disabled) direct-register paths.
  register: jest.fn().mockResolvedValue(undefined),
  loginWithPassword: jest.fn().mockResolvedValue({
    user: { role: 'employer', id: 'e1' },
    onboardingCompleted: true,
  }),
  googleRegister: jest.fn().mockResolvedValue({
    user: { role: 'employer', id: 'e1' },
    onboardingCompleted: true,
  }),
};
