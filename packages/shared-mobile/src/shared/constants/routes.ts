export const ROUTES = {
  AUTH: {
    WELCOME: 'Welcome',
    LOGIN: 'Login',
    OTP_VERIFICATION: 'OtpVerification',
    REGISTER: 'Register',
    REGISTER_OTP: 'RegisterOtp',
    FORGOT_PASSWORD: 'ForgotPassword',
  },
  ONBOARDING: {
    ROLE_SELECTION: 'RoleSelection',
    KYC: 'Kyc',
  },
  TABS: {
    HOME: 'Home',
    DISCOVER: 'Discover',
    MANAGE: 'Manage',
    CHAT: 'Chat',
    WALLET: 'Wallet',
    PROFILE: 'Profile',
  },
  MAIN: {
    JOB_MARKETPLACE: 'JobMarketplace',
    JOB_DETAIL: 'JobDetail',
    MY_APPLICATIONS: 'MyApplications',
    REQUIREMENT_DETAIL: 'RequirementDetail',
    EDIT_PROFILE: 'EditProfile',
    WORKER_PROFILE: 'WorkerProfile',
    POST_REQUIREMENT: 'PostRequirement',
    ADD_WORKER: 'AddWorker',
  },
} as const;
