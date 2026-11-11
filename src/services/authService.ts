import type { User } from '@supabase/supabase-js';
import { getAppIntegrationConfig } from '../config/env';
import { supabase } from '../lib/supabaseClient';
import {
  AuthOperationResult,
  AuthUser,
  LoginCredentials,
  NotificationPreferences,
  RegisterPayload,
} from '../types/auth';
import { ProfileRecord } from '../types/competency';

const DEFAULT_PREFS: NotificationPreferences = {
  email_alerts: true,
  assessment_reminders: true,
  digest_summary: false,
};

export function mapProfileToAuthUser(
  profile: ProfileRecord,
  supabaseUser?: User | null
): AuthUser {
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    approvalStatus: profile.approval_status,
    accountStatus: profile.account_status,
    department: profile.department,
    designation: profile.designation,
    officeLocation: profile.office_location,
    phoneExtension: profile.phone_extension,
    jobRoleId: profile.job_role_id,
    notificationPrefs: {
      ...DEFAULT_PREFS,
      ...(profile.notification_prefs ?? {}),
    },
    emailConfirmedAt: supabaseUser?.email_confirmed_at ?? null,
    createdAt: profile.created_at,
  };
}

export const authService = {
  getIntegrationStatus() {
    return getAppIntegrationConfig();
  },

  async getCurrentSessionAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },

  async fetchProfileById(userId: string, supabaseUser?: User | null): Promise<{
    user: AuthUser | null;
    error: string | null;
  }> {
    if (!supabase) {
      return { user: null, error: 'Supabase client is not configured.' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data) {
      return {
        user: null,
        error:
          'Authenticated user profile was not found in public.profiles. Ensure migration 001_initial_schema.sql has been executed.',
      };
    }

    return {
      user: mapProfileToAuthUser(data as ProfileRecord, supabaseUser),
      error: null,
    };
  },

  async signInWithPassword(credentials: LoginCredentials): Promise<AuthOperationResult> {
    if (!supabase) {
      return {
        ok: false,
        requiresConfiguration: true,
        message:
          'Supabase client environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured.',
      };
    }

    if (!credentials.email.trim() || !credentials.password) {
      return {
        ok: false,
        requiresConfiguration: false,
        message: 'Enter both your institutional email address and password.',
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    if (error) {
      const lowered = error.message.toLowerCase();
      const emailUnconfirmed =
        lowered.includes('email not confirmed') || lowered.includes('confirm your email');
      return {
        ok: false,
        requiresConfiguration: false,
        emailUnconfirmed,
        message: error.message,
      };
    }

    if (!data.user) {
      return {
        ok: false,
        requiresConfiguration: false,
        message: 'Authentication completed without returning a user session.',
      };
    }

    const { user: profileUser, error: profileError } = await this.fetchProfileById(
      data.user.id,
      data.user
    );

    if (profileError || !profileUser) {
      return {
        ok: false,
        requiresConfiguration: false,
        message: profileError ?? 'Failed to load institutional user profile.',
      };
    }

    if (profileUser.accountStatus === 'suspended') {
      await supabase.auth.signOut();
      return {
        ok: false,
        requiresConfiguration: false,
        message: 'This account has been suspended by an administrator. Contact your portal coordinator.',
      };
    }

    return {
      ok: true,
      requiresConfiguration: false,
      message: 'Signed in successfully.',
      user: profileUser,
    };
  },

  async registerAccount(payload: RegisterPayload): Promise<AuthOperationResult> {
    if (!supabase) {
      return {
        ok: false,
        requiresConfiguration: true,
        message:
          'Supabase client environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured.',
      };
    }

    const emailRedirectTo = `${window.location.origin}/login?verified=1`;

    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: payload.fullName.trim(),
          department: payload.department.trim(),
          designation: payload.designation.trim(),
          requested_role: payload.requestedRole,
        },
      },
    });

    if (error) {
      return {
        ok: false,
        requiresConfiguration: false,
        message: error.message,
      };
    }

    // Supabase returns empty identities array when email already exists and email confirm protection is enabled
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        requiresConfiguration: false,
        message: 'An account with this email address already exists. Sign in or reset your password.',
      };
    }

    if (!data.session) {
      const trainerNote =
        payload.requestedRole === 'trainer'
          ? ' Once email verification completes, your Trainer profile will remain in pending status until approved by an Administrator.'
          : '';
      return {
        ok: true,
        requiresConfiguration: false,
        requiresEmailVerification: true,
        message: `Verification link sent to ${payload.email.trim()}. Confirm your email address before signing in.${trainerNote}`,
      };
    }

    const { user: profileUser } = await this.fetchProfileById(data.user!.id, data.user);

    return {
      ok: true,
      requiresConfiguration: false,
      requiresEmailVerification: false,
      user: profileUser,
      message:
        payload.requestedRole === 'trainer'
          ? 'Account created. Your Trainer access is marked pending until verified by an Administrator.'
          : 'Account registered and active.',
    };
  },

  async resendVerificationEmail(email: string): Promise<{ ok: boolean; message: string }> {
    if (!supabase) {
      return { ok: false, message: 'Supabase client is not configured.' };
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: `A new verification link has been dispatched to ${email.trim()}.`,
    };
  },

  async sendPasswordResetEmail(email: string): Promise<{ ok: boolean; message: string }> {
    if (!supabase) {
      return { ok: false, message: 'Supabase client is not configured.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: `If an account exists for ${email.trim()}, a password recovery link has been sent.`,
    };
  },

  async updatePassword(newPassword: string): Promise<{ ok: boolean; message: string }> {
    if (!supabase) {
      return { ok: false, message: 'Supabase client is not configured.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: 'Your account password has been updated.',
    };
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
};
