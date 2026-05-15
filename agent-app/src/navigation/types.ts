// Agent-app route param list — Agent + Worker + SelfWorker, no employer, no admin
export type AgentStackParamList = {
  // Auth
  Welcome: undefined;
  Login: undefined;
  OtpVerification: { phone: string };
  Register: undefined;
  RegisterOtp: {
    phone: string;
    role: 'Agent' | 'SelfWorker';
    name: string;
    password: string;
    state: string;
    district: string;
    block: string;
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
  };
  ForgotPassword: undefined;
  // Onboarding
  Kyc: undefined;
  // Main
  Main: undefined;
  EditProfile: undefined;
  JobMarketplace: { workType?: string; subCategory?: string } | undefined;
  JobDetail: { jobId: string };
  MyApplications: undefined;
  RequirementDetail: { requirementId: string };
  WorkerProfile: { workerId: string };
  WorkerSearch: { workType?: string } | undefined;
  AddWorker: undefined;
  KycVerification: undefined;
  NotificationPreferences: undefined;
  Notifications: undefined;
  Support: undefined;
  TermsPrivacy: undefined;
  ChatRoom: { roomId: string; roomName: string; roomAvatar?: string };
  // Worker-specific
  Wallet: undefined;
  Attendance: undefined;
  Profile: undefined;
};

// Keep MainStackParamList alias so agent/worker screens can be typed with it
export type MainStackParamList = AgentStackParamList;
