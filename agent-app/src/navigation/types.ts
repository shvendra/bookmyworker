import type { AppRole } from '../../../packages/shared-mobile/src/shared/types/domain';

// Agent-app route param list — Agent + Worker + SelfWorker, no employer, no admin
export type AgentStackParamList = {
  // First-launch language selection
  LanguageSelect: undefined;
  // Auth
  Welcome: undefined;
  Login: { roleHint?: AppRole; appContext?: 'agent-app' } | undefined;
  OtpVerification: { phone: string; roleHint?: AppRole; appContext?: 'agent-app' };
  Register: undefined;
  RegisterOtp: {
    phone: string;
    alternate?: string;
    role: 'Agent' | 'SelfWorker';
    name: string;
    password: string;
    language?: string;
    state?: string;
    district?: string;
    block?: string;
    pinCode?: string;
    email?: string;
    referredBy?: string;
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
  // Onboarding
  WorkCategorySelect: undefined;
  Kyc: undefined;
  WorkerProfileCompletion: undefined;
  // Main
  Main: undefined;
  EditProfile: undefined;
  JobMarketplace: { workType?: string; subCategory?: string; myInterests?: boolean; likedOnly?: boolean } | undefined;
  JobMarketplaceDetail: { requirementId: string };
  JobDetail: { jobId: string };
  MyApplications: undefined;
  RequirementDetail: { requirementId: string };
  WorkerProfile: { workerId: string };
  WorkerSearch: { workType?: string } | undefined;
  AddWorker: undefined;
  AgentWorkers: undefined;
  SwitchAccount: undefined;
  Certificates: undefined;
  KycVerification: undefined;
  NotificationPreferences: undefined;
  Notifications: undefined;
  MyActivity: undefined;
  Support: undefined;
  TermsPrivacy: undefined;
  ChatRoom: { roomId: string; roomName: string; roomAvatar?: string };
  Profile: undefined;
  // Placements
  MyPlacements: undefined;
  // Subscription / badge purchase
  Subscription: { agentId?: string } | undefined;
  PaymentWebView: { url: string; merchantOrderId: string; returnTo?: string };
  TopupWebView: { url: string; merchantOrderId: string };
  PdfViewer: { url: string; title?: string };
  Invitations: undefined;
};

// Keep MainStackParamList alias so agent/worker screens can be typed with it
export type MainStackParamList = AgentStackParamList;
