import type { AppLanguage, AppRole, AuthTokens, UserProfile } from '../../shared/types/domain';

export interface AuthSession {
  tokens: AuthTokens;
  user: UserProfile;
  onboardingCompleted: boolean;
  availableRoles?: string[];   // backend role strings e.g. ['Agent','Employer']
  defaultRole?: string;        // which role opens automatically on login
}

export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  session: AuthSession | null;
}

export interface AuthContextValue {
  state: AuthState;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => void;
  updateRole: (role: AppRole) => Promise<void>;
  switchRole: (backendRole: string) => Promise<void>;
  setDefaultRole: (backendRole: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
}
