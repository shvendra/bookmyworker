// workerApi mock. The agent register screen only touches uploadResume (in the
// no-OTP direct-registration path); stub it so tests don't import the real
// axios-backed client.
export const workerApi = {
  uploadResume: jest.fn().mockResolvedValue(undefined),
};
