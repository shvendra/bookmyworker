import { apiClient } from '../client';
import type { AppRole, UserProfile } from '../../../shared/types/domain';

export interface RequestOtpPayload {
  phone: string;
  roleHint?: AppRole;
}

export interface VerifyOtpPayload {
  phone: string;
  otp: string;
  pushToken?: string;
  roleHint?: AppRole;
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
    case 'SelfWorker':
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
    language: 'en',
    email: u.email,
    state: u.state,
    district: u.district,
    profileImage: u.profilePhoto,
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
  });
  const body = response.data as { message?: string };
  return { message: body.message ?? 'OTP sent successfully' };
};

export interface RegisterPayload {
  name: string;
  phone: string;
  password: string;
  role: 'Employer' | 'Agent' | 'SelfWorker';
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
  workExperience?: number;
  salaryType?: string;
  fixedSalary?: number;
  salaryFrom?: number;
  salaryTo?: number;
}

export const registerUser = async (payload: RegisterPayload): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/v1/user/register', payload);
  const body = response.data as { message?: string };
  return { message: body.message ?? 'Registered successfully' };
};

export const verifyOtpOnly = async (phone: string, otp: string): Promise<void> => {
  await apiClient.post('/api/v1/otp/verify-otp', { phone, otp, role: 'register' });
};

export const verifyOtp = async (payload: VerifyOtpPayload): Promise<VerifyOtpResponse> => {
  const response = await apiClient.post('/api/v1/user/login', {
    phone: payload.phone,
    otp: payload.otp,
    loginMethod: 'otp',
    ...(payload.roleHint ? { role: toBackendRole(payload.roleHint) } : {}),
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
}): Promise<VerifyOtpResponse> => {
  const response = await apiClient.post('/api/v1/user/login', {
    ...payload,
    loginMethod: 'password',
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
  await apiClient.post('/api/v1/otp/send-otp', { ...payload, role: payload.role });
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
