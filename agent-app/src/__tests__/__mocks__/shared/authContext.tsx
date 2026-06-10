// Auth context mock. `__auth` is mutated by tests to drive every auth branch.
// Exposes the full surface the agent-app screens consume: state + the async
// profile/onboarding mutators and signOut.
import React from 'react';

type User = {
  role: string;
  id?: string;
  fullName?: string;
  language?: string;
  kycStatus?: string;
};

type Session = {
  user: User;
  onboardingCompleted?: boolean;
} | null;

type AuthState = {
  status: 'loading' | 'unauthenticated' | 'authenticated';
  session: Session;
};

export const __auth: {
  state: AuthState;
  signIn: jest.Mock;
  signOut: jest.Mock;
  updateProfile: jest.Mock;
  setLanguage: jest.Mock;
  completeOnboarding: jest.Mock;
} = {
  state: { status: 'unauthenticated', session: null },
  signIn: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn().mockResolvedValue(undefined),
  setLanguage: jest.fn().mockResolvedValue(undefined),
  completeOnboarding: jest.fn().mockResolvedValue(undefined),
};

export const __resetAuth = (): void => {
  __auth.state = { status: 'unauthenticated', session: null };
  __auth.signIn.mockReset();
  __auth.signOut.mockReset();
  __auth.updateProfile.mockReset().mockResolvedValue(undefined);
  __auth.setLanguage.mockReset().mockResolvedValue(undefined);
  __auth.completeOnboarding.mockReset().mockResolvedValue(undefined);
};

export const useAuth = () => __auth;

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => children;
