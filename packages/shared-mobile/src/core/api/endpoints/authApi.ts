import { apiClient } from '../client';
import { buildPhotoUrl } from '../../config/env';
import type { AppLanguage, AppRole, UserProfile } from '../../../shared/types/domain';

export type AppContext = 'employer-app' | 'agent-app';

export interface RequestOtpPayload {
  phone: string;
  roleHint?: AppRole;
  appContext?: AppContext;
}

export interface VerifyOtpPayload {
  phone: string;
  otp: string;
  pushToken?: string;
  roleHint?: AppRole;
  appContext?: AppContext;
}

// Raw user shape returned by backend
interface BackendUser {
  _id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  email?: string;
  state?: string;
  district?: string;
  block?: string;
  profilePhoto?: string;
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  subscriptionExpiry?: string;
  remainingContacts?: number;
  employerType?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean };
  veryfiedBage?: boolean;
  workerSubType?: string;
  agentType?: string;
  resumeUrl?: string;
  areasOfWork?: string[];
  serviceArea?: string[];
  categories?: string[];
  gender?: string;
  dob?: string | number;
  language?: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: UserProfile;
  availableRoles?: string[];
}

// Map capitalized backend role → lowercase frontend AppRole
function mapRole(backendRole: string): AppRole {
  switch (backendRole) {
    case 'Employer': return 'employer';
    case 'SelfWorker': return 'selfworker';
    case 'Worker': return 'worker';
    case 'Agent': return 'agent';
    case 'Admin': return 'admin';
    case 'SuperAdmin': return 'superadmin';
    default: return 'worker';
  }
}

function mapBackendUser(u: BackendUser): UserProfile {
  return {
    id: u._id,
    fullName: u.name,
    phone: u.phone,
    role: mapRole(u.role),
    kycStatus: u.status === 'Verified' ? 'verified' : u.status === 'Block' ? 'rejected' : 'pending',
    language: (u.language as AppLanguage | undefined) ?? undefined,
    email: u.email,
    state: u.state,
    district: u.district,
    block: u.block,
    profileImage: buildPhotoUrl(u.profilePhoto),
    isSubscribed: u.isSubscribed,
    subscriptionExpiry: u.subscriptionExpery ?? u.subscriptionExpiry,
    remainingContacts: u.remainingContacts,
    employerType: u.employerType,
    veryfiedBage: u.veryfiedBage,
    workerSubType: u.workerSubType,
    agentType: u.agentType,
    resumeUrl: u.resumeUrl,
    areasOfWork: u.areasOfWork,
    serviceArea: u.serviceArea,
    categories: u.categories,
    gender: u.gender,
    dob: u.dob !== undefined ? String(u.dob) : undefined,
  };
}

// Map frontend AppRole to the backend role string expected by send-otp-user
function toBackendRole(role?: AppRole): string {
  switch (role) {
    case 'employer': return 'Employer';
    case 'worker': return 'SelfWorker';
    case 'agent': return 'Agent';
    case 'admin': return 'Admin';
    default: return 'register';
  }
}

export const requestOtp = async (payload: RequestOtpPayload): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/v1/otp/send-otp-user', {
    phone: payload.phone,
    role: toBackendRole(payload.roleHint),
    ...(payload.appContext ? { appContext: payload.appContext } : {}),
  });
  const body = response.data as { message?: string };
  return { message: body.message ?? 'OTP sent successfully' };
};

export interface RegisterPayload {
  name: string;
  phone: string;
  password: string;
  role: 'Employer' | 'Agent' | 'SelfWorker';
  language?: string;
  state?: string;
  district?: string;
  block?: string;
  pinCode?: string;
  email?: string;
  referredBy?: string;
  employerType?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean };
  gender?: string;
  dob?: string;
  address?: string;
  areasOfWork?: string[];
  categories?: string[];
  workExperience?: number;
  salaryType?: string;
  fixedSalary?: number;
  salaryFrom?: number;
  salaryTo?: number;
  workerSubType?: string;
  agentType?: string;
}

export const registerUser = async (payload: RegisterPayload): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/v1/user/register', payload);
  const body = response.data as { message?: string };
  return { message: body.message ?? 'Registered successfully' };
};

export const verifyOtpOnly = async (
  phone: string,
  otp: string
): Promise<any> => {
  const res = await apiClient.post('/api/v1/otp/verify-otp', {
    phone,
    otp,
    role: 'register',
  });

  // IMPORTANT: enforce failure handling
  if (!res?.data?.success) {
    throw new Error(res?.data?.message || 'Invalid OTP');
  }

  return res.data;
};

export const verifyOtp = async (payload: VerifyOtpPayload): Promise<VerifyOtpResponse> => {
  const response = await apiClient.post('/api/v1/user/login', {
    phone: payload.phone,
    otp: payload.otp,
    loginMethod: 'otp',
    ...(payload.roleHint ? { role: toBackendRole(payload.roleHint) } : {}),
    ...(payload.appContext ? { appContext: payload.appContext } : {}),
  });
  const body = response.data as { token?: string; user?: BackendUser; availableRoles?: string[] };

  if (!body.token || !body.user) {
    throw new Error('Invalid auth response from server.');
  }

  return {
    token: body.token,
    user: mapBackendUser(body.user),
    availableRoles: body.availableRoles,
  };
};

export const setDefaultRoleApi = async (role: string): Promise<void> => {
  await apiClient.post('/api/v1/user/set-default-role', { role });
};

// ── Google Sign-In (employer) ────────────────────────────────────────────────
export interface GoogleStartResult {
  loggedIn: boolean;
  needsPhone?: boolean;
  name?: string;
  email?: string;
  googleTicket?: string;
  session?: VerifyOtpResponse;   // present when loggedIn
}

export const googleStart = async (idToken: string, appContext?: AppContext): Promise<GoogleStartResult> => {
  const response = await apiClient.post('/api/v1/user/google/start', { idToken, appContext });
  const body = response.data as { loggedIn?: boolean; token?: string; user?: BackendUser; availableRoles?: string[]; needsPhone?: boolean; name?: string; email?: string; googleTicket?: string };
  if (body.loggedIn && body.token && body.user) {
    return { loggedIn: true, session: { token: body.token, user: mapBackendUser(body.user), availableRoles: body.availableRoles } };
  }
  return { loggedIn: false, needsPhone: !!body.needsPhone, name: body.name, email: body.email, googleTicket: body.googleTicket };
};

export const googleRegister = async (payload: {
  googleTicket: string;
  phone: string;
  name?: string;
  employerType?: unknown;
  state?: string;
  district?: string;
  block?: string;
  referredBy?: string;
}): Promise<VerifyOtpResponse> => {
  const response = await apiClient.post('/api/v1/user/google/register', payload);
  const body = response.data as { token?: string; user?: BackendUser; availableRoles?: string[] };
  if (!body.token || !body.user) throw new Error('Google registration failed.');
  return { token: body.token, user: mapBackendUser(body.user), availableRoles: body.availableRoles };
};

export const switchRoleApi = async (role: string, phone?: string): Promise<VerifyOtpResponse> => {
  const response = await apiClient.post('/api/v1/user/setrole', { role, phone });
  const body = response.data as { token?: string; user?: BackendUser; availableRoles?: string[] };
  if (!body.token || !body.user) throw new Error('Role switch failed.');
  return {
    token: body.token,
    user: mapBackendUser(body.user),
    availableRoles: body.availableRoles,
  };
};

export const loginWithPassword = async (payload: {
  phone?: string;
  email?: string;
  password: string;
  roleHint?: AppRole;
  appContext?: AppContext;
}): Promise<VerifyOtpResponse> => {
  const backendRole = payload.roleHint ? toBackendRole(payload.roleHint) : undefined;
  const response = await apiClient.post('/api/v1/user/login', {
    phone: payload.phone,
    email: payload.email,
    password: payload.password,
    loginMethod: 'password',
    ...(backendRole ? { role: backendRole } : {}),
    ...(payload.appContext ? { appContext: payload.appContext } : {}),
  });
  const body = response.data as { token?: string; user?: BackendUser; availableRoles?: string[] };
  if (!body.token || !body.user) throw new Error('Invalid auth response from server.');
  return { token: body.token, user: mapBackendUser(body.user), availableRoles: body.availableRoles };
};

export const sendPasswordResetOtp = async (payload: {
  phone?: string;
  email?: string;
  role: string;
}): Promise<void> => {
  await apiClient.post('/api/v1/otp/send-otp-user', { phone: payload.phone, role: payload.role });
};

export const verifyPasswordResetOtp = async (payload: {
  phone?: string;
  email?: string;
  otp: string;
}): Promise<void> => {
  await apiClient.post('/api/v1/otp/verify-otp', { ...payload, role: 'resetPassword' });
};

export const resetPassword = async (payload: {
  phone?: string;
  email?: string;
  password: string;
  role: string;
}): Promise<void> => {
  await apiClient.put('/api/v1/user/update/password', payload);
};

export const getCurrentUser = async (): Promise<UserProfile> => {
  const response = await apiClient.get('/api/v1/user/getuser');
  const body = response.data as { user?: BackendUser } | BackendUser;
  const raw = (body as { user?: BackendUser }).user ?? (body as BackendUser);
  return mapBackendUser(raw);
};

export interface ProfileFields {
  name?: string;
  state?: string;
  district?: string;
  block?: string;
  gender?: string;
  dob?: string | number;
  address?: string;
  email?: string;
  areasOfWork?: string[];
  serviceArea?: string[];
  categories?: string[];
  workerSubType?: string;
  agentType?: string;
  workExperience?: string | number;
  salaryType?: string;
  fixedSalary?: string | number;
  salaryFrom?: string | number;
  salaryTo?: string | number;
  employerType?: Record<string, boolean>;
  preferredWorkLocations?: string[];
}

export const updateProfileFields = async (fields: ProfileFields): Promise<UserProfile> => {
  const response = await apiClient.put('/api/v1/user/update', fields, {
    headers: { 'Content-Type': 'application/json' },
  });
  const body = response.data as { user?: BackendUser } | BackendUser;
  const raw = (body as { user?: BackendUser }).user ?? (body as BackendUser);
  return mapBackendUser(raw);
};

export const updateProfile = async (formData: FormData): Promise<UserProfile> => {
  const response = await apiClient.put('/api/v1/user/update', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const body = response.data as { user?: BackendUser } | BackendUser;
  const raw = (body as { user?: BackendUser }).user ?? (body as BackendUser);
  return mapBackendUser(raw);
};

export const uploadKyc = async (jobId: string, formData: FormData): Promise<void> => {
  await apiClient.put(`/api/v1/user/upload-kyc/${jobId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const generateUploadLink = async (): Promise<{ link: string; jobId: string }> => {
  const response = await apiClient.post('/api/v1/user/generate-upload-link');
  return response.data as { link: string; jobId: string };
};
