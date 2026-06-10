// Navigation ref mock. `isReady` is mutable per test to cover the guard branch.
export const navigationRef = {
  isReady: jest.fn(() => true),
  navigate: jest.fn(),
};
