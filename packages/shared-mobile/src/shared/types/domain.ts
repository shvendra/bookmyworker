export type AppRole = 'worker' | 'employer' | 'agent' | 'selfworker' | 'admin' | 'superadmin';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type AppLanguage = 'en' | 'hi' | 'mr' | 'gu' | 'ta' | 'te' | 'kn' | 'ml' | 'bn' | 'or' | 'pa';

export type EmployerTypeKey = 'individual' | 'contractor' | 'agency' | 'industry';

export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  role: AppRole;
  kycStatus: KycStatus;
  language: AppLanguage;
  email?: string;
  profileImage?: string;
  state?: string;
  district?: string;
  block?: string;
  tehsil?: string;
  serviceArea?: string[];
  areasOfWork?: string[];
  // Employer subscription fields
  isSubscribed?: boolean;
  subscriptionExpiry?: string;
  remainingContacts?: number;
  employerType?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean };
  // Verified badge (paid, agent-specific)
  veryfiedBage?: boolean;
  // Worker sub-type (ITI/Diploma, Graduate, Skilled, Unskilled)
  workerSubType?: string;
  // Agent type (Group worker supplier, etc.)
  agentType?: string;
  // Personal info
  dob?: string;
  gender?: string;
  // Work categories (subcategories like 'Mason', 'Electrician')
  categories?: string[];
  // Cities/districts where user prefers to work
  preferredWorkLocations?: string[];
  // Public S3 URL of the uploaded resume (PDF/Word)
  resumeUrl?: string;
  // Skill certificates (worker) and labour licence (agent)
  certificates?: Certificate[];
  labourLicenceUrl?: string | null;
}

export interface Certificate {
  url: string;
  name: string;
  fileType: 'image' | 'pdf';
  uploadedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface WorkerProfile {
  id: string;
  fullName: string;
  phone: string;
  category: string;
  subCategory?: string;
  state: string;
  district: string;
  tehsil: string;
  experienceYears: number;
  rating: number;
  verified: boolean;
  profileImage?: string;
  kycStatus: KycStatus;
  bio?: string;
  skills?: string[];
  dailyRate?: number;
  monthlyRate?: number;
  available: boolean;
  totalJobsDone?: number;
}

export type RequirementStatus = 'open' | 'invited' | 'fulfilled' | 'closed';

export interface JobRequirement {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  workerCount: number;
  location: string;
  state: string;
  district: string;
  tehsil: string;
  status: RequirementStatus;
  description?: string;
  dailyRate?: number;
  duration?: string;
  postedBy?: string;
  postedByName?: string;
  createdAt: string;
  updatedAt?: string;
  applicants?: number;
}

export type ApplicationStatus = 'Pending' | 'Invited' | 'Accepted' | 'Rejected' | 'Closed';

export interface Application {
  id: string;
  requirementId: string;
  requirementTitle: string;
  workerId: string;
  workerName: string;
  workerPhone?: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantImages?: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: string;
  read: boolean;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'file' | null;
  fileName?: string | null;
}

export type TransactionDirection = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface WalletTransaction {
  id: string;
  amount: number;
  direction: TransactionDirection;
  description: string;
  createdAt: string;
  status: TransactionStatus;
  referenceId?: string;
  type?: 'payout' | 'topup' | 'commission' | 'refund' | 'charge';
}

export interface WalletSummary {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingAmount: number;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  requirementId: string;
  requirementTitle: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: 'present' | 'absent' | 'half-day';
  location?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  role: AppRole;
  state?: string;
  district?: string;
  callStatus: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  agentId?: string;
  verified: boolean;
}

export interface DashboardStats {
  totalWorkers?: number;
  totalEmployers?: number;
  totalAgents?: number;
  totalRequirements?: number;
  activeRequirements?: number;
  totalApplications?: number;
  totalRevenue?: number;
  pendingKyc?: number;
  todayRegistrations?: number;
  weekRegistrations?: number;
  monthRegistrations?: number;
}

export interface AgentStats {
  totalLeads: number;
  verifiedLeads: number;
  pendingLeads: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  activeRequirements: number;
  fulfilledRequirements: number;
}

export interface Invitation {
  id: string;
  workerId: string;
  workerName: string;
  workerPhone?: string;
  requirementId: string;
  requirementTitle: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  category?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'chat' | 'application' | 'requirement' | 'payout' | 'system';
  read: boolean;
  createdAt: string;
  data?: Record<string, string>;
}
