// Employer-app route param list — employer-only, no role switching
export type EmployerStackParamList = {
  // Auth
  LanguageSelect: undefined;
  Welcome: undefined;
  Login: { roleHint?: 'employer'; appContext?: 'employer-app' } | undefined;
  OtpVerification: { phone: string; roleHint?: 'employer'; appContext?: 'employer-app' };
  Register: undefined;
  RegisterOtp: {
    phone: string;
    role: 'Employer';
    name: string;
    password: string;
    state?: string;
    district?: string;
    block?: string;
    pinCode?: string;
    email?: string;
    referredBy?: string;
    employerType?: string;
    gender?: string;
    dob?: string;
    address?: string;
    // Set when finishing a Google sign-up — RegisterOtp finalizes via google/register.
    googleTicket?: string;
  };
  ForgotPassword: { roleHint?: 'employer' } | undefined;
  // Onboarding
  Kyc: undefined;
  // Main
  Main: undefined;
  EditProfile: undefined;
  PostRequirement: {
    workType?: string;
    reqType?: string;
    prefill?: {
      workType?: string;
      subCategory?: string;
      reqType?: string;
      state?: string;
      district?: string;
      tehsil?: string;
      workerQuantitySkilled?: number;
      salaryType?: string;
      budgetPerWorker?: number;
      minBudgetPerWorker?: number;
      maxBudgetPerWorker?: number;
      remarks?: string;
      inTime?: string;
      outTime?: string;
      accommodationAvailable?: boolean;
      foodAvailable?: boolean;
      transportProvided?: boolean;
      weeklyOff?: boolean;
      overtimeAvailable?: boolean;
      incentive?: boolean;
      bonus?: boolean;
    };
  } | undefined;
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
  // Attendance screen
  EmployerAttendance: { requirementId: string; requirementTitle?: string };
  // Hiring analytics
  EmployerAnalytics: undefined;
  // Sign platform agreement
  EmployerAgreement: undefined;
  // Requirement calendar
  RequirementCalendar: undefined;
  // Call & remark history
  CallHistory: undefined;
  // Viewed worker contacts history
  ViewedContacts: undefined;
  // Document hub (per requirement)
  DocumentHub: { requirementId: string; requirementTitle?: string };
  // Wallet / Transactions
  Transactions: undefined;
  // Subscription + payment flow
  Subscription: { agentId?: string } | undefined;
  PlanPricing: undefined;
  PaymentWebView: { url: string; merchantOrderId: string; returnTo?: string };
  TopupWebView: { url: string; merchantOrderId: string };
  PdfViewer: { url: string; title?: string };
  RequirementInvitations: { requirementId: string; requirementTitle?: string };
};

// Keep MainStackParamList alias so employer screens can be typed with it
export type MainStackParamList = EmployerStackParamList;
