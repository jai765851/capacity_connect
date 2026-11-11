export type UserRole = 'trainee' | 'trainer' | 'admin';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AccountStatus = 'active' | 'suspended';

export interface NotificationPreferences {
  email_alerts: boolean;
  assessment_reminders: boolean;
  digest_summary: boolean;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  accountStatus: AccountStatus;
  department: string;
  designation: string;
  officeLocation: string;
  phoneExtension: string;
  jobRoleId: string | null;
  notificationPrefs: NotificationPreferences;
  emailConfirmedAt: string | null;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  department: string;
  designation: string;
  requestedRole: Exclude<UserRole, 'admin'>;
  password: string;
}

export interface AuthOperationResult {
  ok: boolean;
  requiresConfiguration: boolean;
  requiresEmailVerification?: boolean;
  emailUnconfirmed?: boolean;
  message: string;
  user?: AuthUser | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  trainee: 'Trainee',
  trainer: 'Trainer',
  admin: 'Admin',
};

export const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  trainee: '/dashboard/trainee',
  trainer: '/dashboard/trainer',
  admin: '/dashboard/admin',
};
