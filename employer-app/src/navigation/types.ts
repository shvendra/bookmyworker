// Employer-app route param list — employer-only, no role switching
export type EmployerStackParamList = {
  // Auth
  Welcome: undefined;
  Login: { roleHint?: 'employer'; appContext?: 'employer-app' } | undefined;
  OtpVerification: { phone: string; roleHint?: 'employer'; appContext?: 'employer-app' };
  Register: undefined;
  RegisterOtp: {
    phone: string;
    role: 'Employer';
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
  };
  ForgotPassword: { roleHint?: 'employer' } | undefined;
  // Onboarding
  Kyc: undefined;
  // Main
  Main: undefined;
  EditProfile: undefined;
  PostRequirement: undefined;
  RequirementDetail: { requirementId: string };
  WorkerProfile: { workerId: string };
  WorkerSearch: { workType?: string } | undefined;
  JobMarketplace: { workType?: string; subCategory?: string } | undefined;
  KycVerification: undefined;
  NotificationPreferences: undefined;
  Notifications: undefined;
  MyActivity: undefined;
  Support: undefined;
  TermsPrivacy: undefined;
  ChatRoom: { roomId: string; roomName: string; roomAvatar?: string };
  // Pipeline overview
  EmployerPipeline: undefined;
  // Wallet (for Transactions tab)
  Transactions: undefined;
  // Subscription + payment flow
  Subscription: { agentId?: string } | undefined;
  PaymentWebView: { url: string; merchantOrderId: string; returnTo?: string };
  TopupWebView: { url: string; merchantOrderId: string };
  PdfViewer: { url: string; title?: string };
};

// Keep MainStackParamList alias so employer screens can be typed with it
export type MainStackParamList = EmployerStackParamList;
