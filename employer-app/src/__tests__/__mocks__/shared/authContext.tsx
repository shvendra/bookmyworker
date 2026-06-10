// Auth context mock. `__auth` is mutated by tests to drive every auth branch.
import React from 'react';

type Session = {
  user: { role: string };
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
} = {
  state: { status: 'unauthenticated', session: null },
  signIn: jest.fn(),
  signOut: jest.fn(),
};

export const __resetAuth = (): void => {
  __auth.state = { status: 'unauthenticated', session: null };
  __auth.signIn.mockReset();
  __auth.signOut.mockReset();
};

export const useAuth = () => __auth;

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => children;
