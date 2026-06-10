// authService mock — both methods are configurable jest mocks.
export const authService = {
  requestOtp: jest.fn().mockResolvedValue(undefined),
  googleStart: jest.fn().mockResolvedValue({ loggedIn: false }),
};
