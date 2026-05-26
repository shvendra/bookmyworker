import type { AppRole } from '../../shared/types/domain';

// Single flat root stack — React Navigation auth-flow pattern
export type RootStackParamList = {
  // ── Auth ──────────────────────────────────────────────────────
  Welcome: undefined;
  Login: { roleHint?: AppRole; appContext?: 'employer-app' | 'agent-app' } | undefined;
  OtpVerification: { phone: string; roleHint?: AppRole; appContext?: 'employer-app' | 'agent-app' };
  Register: undefined;
  RegisterOtp: {
    phone: string;
    role: 'Employer' | 'Agent' | 'SelfWorker';
    name: string;
    password: string;
    state: string;
    district: string;
    block: string;
    pinCode?: string;
    email?: string;
    referredBy?: string;
    employerType?: string;
    gender?: string;
    dob?: string;
    address?: string;
    areasOfWork?: string[];
    categories?: string[];
    workExperience?: string;
    salaryType?: string;
    fixedSalary?: string;
    salaryFrom?: string;
    salaryTo?: string;
    workerSubType?: string;
    agentType?: string;
    resumeUri?: string;
    resumeName?: string;
  };
  ForgotPassword: { roleHint?: AppRole } | undefined;
  // ── Onboarding ────────────────────────────────────────────────
  RoleSelection: undefined;
  Kyc: undefined;
  // ── Authenticated: tabs (root) + inner screens ───────────────
  Main: undefined;
  EditProfile: undefined;
  JobMarketplace: { workType?: string; subCategory?: string; myInterests?: boolean; likedOnly?: boolean } | undefined;
  JobDetail: { jobId: string };
  MyApplications: undefined;
  RequirementDetail: { requirementId: string };
  WorkerProfile: { workerId: string };
  PostRequirement: { workType?: string; reqType?: string } | undefined;
  AddWorker: undefined;
  AgentWorkers: undefined;
  WorkerSearch: { workType?: string } | undefined;
  KycVerification: undefined;
  NotificationPreferences: undefined;
  Support: undefined;
  TermsPrivacy: undefined;
  Notifications: undefined;
  MyActivity: undefined;
  SwitchAccount: undefined;
  ChatRoom: { roomId: string; roomName: string; roomAvatar?: string };
  Subscription: { agentId?: string } | undefined;
  PaymentWebView: { url: string; merchantOrderId: string; returnTo?: keyof RootStackParamList };
  TopupWebView: { url: string; merchantOrderId: string };
  Shortlist: undefined;
  EmployerPipeline: undefined;
  PdfViewer: { url: string; title?: string };
};

// Aliases so existing imports don't need updating
export type AuthStackParamList = RootStackParamList;
export type OnboardingStackParamList = RootStackParamList;
export type MainStackParamList = RootStackParamList;

export type AppTabsParamList = {
  Home: undefined;
  Discover: undefined;
  Manage: undefined;
  Chat: undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { roomId: string; roomName: string; roomAvatar?: string };
};
