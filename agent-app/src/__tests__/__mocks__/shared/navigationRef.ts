// Navigation ref mock. `isReady` is mutable per test to cover the guard branch.
// `reset` + the imperative `resetTo*` helpers are jest mocks so AppNavigator and
// the KYC screen can assert their navigation side-effects.
export const navigationRef = {
  isReady: jest.fn(() => true),
  navigate: jest.fn(),
  reset: jest.fn(),
};

export const resetToWelcome = jest.fn();
export const resetToMain = jest.fn();
export const resetToProfileCompletion = jest.fn();
