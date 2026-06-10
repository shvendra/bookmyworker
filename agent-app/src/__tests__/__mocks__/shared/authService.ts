// authService mock — methods used by the agent register flow.
export const authService = {
  requestOtp: jest.fn().mockResolvedValue(undefined),
  googleStart: jest.fn().mockResolvedValue({ loggedIn: false }),
};
