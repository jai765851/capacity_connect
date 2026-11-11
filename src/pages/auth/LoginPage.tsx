import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/FormField';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { fetchServerHealthStatus, ServerHealthStatus } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { ROLE_DASHBOARD_PATHS } from '../../types/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, isSupabaseConfigured, refreshProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [authStatus, setAuthStatus] = useState<{
    tone: 'info' | 'warning' | 'success' | 'error';
    title: string;
    description: string;
  } | null>(() =>
    searchParams.get('verified') === '1'
      ? {
          tone: 'success',
          title: 'Email Verification Processed',
          description: 'Your email address has been verified. Sign in below to enter your role workspace.',
        }
      : null
  );
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [health, setHealth] = useState<ServerHealthStatus | null>(null);

  useEffect(() => {
    fetchServerHealthStatus().then(setHealth);
  }, []);

  useEffect(() => {
    if (currentUser) {
      navigate(ROLE_DASHBOARD_PATHS[currentUser.role], { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid institutional email address.';
    }
    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    setShowResendVerification(false);
    const result = await authService.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (!result.ok) {
      setShowResendVerification(Boolean(result.emailUnconfirmed));
      setAuthStatus({
        tone: result.requiresConfiguration ? 'warning' : 'error',
        title: result.requiresConfiguration ? 'Supabase Configuration Pending' : 'Sign-In Failed',
        description: result.message,
      });
      return;
    }

    await refreshProfile();
    if (result.user) {
      navigate(ROLE_DASHBOARD_PATHS[result.user.role], { replace: true });
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setIsResending(true);
    const res = await authService.resendVerificationEmail(email);
    setIsResending(false);
    setAuthStatus({
      tone: res.ok ? 'success' : 'error',
      title: res.ok ? 'Verification Email Sent' : 'Unable to Resend Link',
      description: res.message,
    });
  };

  return (
    <div className="bg-slate-50 py-12 lg:py-16 px-4 sm:px-6 lg:px-8 min-h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        {!isSupabaseConfigured && (
          <StatusBanner
            tone="warning"
            title="Supabase Client Environment Variables Missing"
            description="Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment and execute migrations 001–006 in Supabase SQL Editor before signing in."
          />
        )}

        {isSupabaseConfigured && health && !health.databaseSchemaReady && (
          <StatusBanner
            tone="warning"
            title="Supabase Database Schema Migrations Pending"
            description="Supabase credentials are connected, but core PostgreSQL tables are not initialized yet. Run SQL migrations 001 through 006 from /supabase/migrations in your Supabase SQL Editor before signing in or bootstrapping an Administrator."
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <Card className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <BrandMark />
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                    Portal Sign In
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Authenticate with your verified institutional email and password.
                  </p>
                </div>
              </div>

              {authStatus && (
                <StatusBanner
                  tone={authStatus.tone}
                  title={authStatus.title}
                  description={authStatus.description}
                  action={
                    showResendVerification ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isResending}
                        onClick={handleResendVerification}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{isResending ? 'Sending...' : 'Resend Link'}</span>
                      </Button>
                    ) : undefined
                  }
                />
              )}

              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                <TextField
                  htmlFor="login-email"
                  label="Institutional Email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErrors.email}
                  placeholder="officer@organisation.gov.in"
                />

                <TextField
                  htmlFor="login-password"
                  label="Password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                  placeholder="Enter password"
                />

                <div className="flex items-center justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[#0F766E] hover:text-[#0B1F3A]"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting || !isSupabaseConfigured}
                  >
                    <Lock className="w-4 h-4" />
                    <span>{isSubmitting ? 'Signing In...' : 'Sign In to Portal'}</span>
                  </Button>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <span>Need an organisational account?</span>
              <Link
                to="/register"
                className="font-semibold text-[#0F766E] hover:text-[#0B1F3A] transition-colors"
              >
                Register Account →
              </Link>
            </div>
          </Card>

          <Card tone="navy" className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-9 h-9 rounded-md bg-white/10 text-teal-300 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white">
                Role-Based Access Governance
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                CAPACITY CONNECT routes authenticated users automatically to their database-assigned
                role portal using PostgreSQL Row-Level Security.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                <li className="border-t border-white/10 pt-2.5">
                  <span className="font-semibold text-white">Trainees:</span> Immediate access upon
                  email verification for skill assessment and training assignment.
                </li>
                <li className="border-t border-white/10 pt-2.5">
                  <span className="font-semibold text-white">Trainers:</span> Self-registered trainers
                  require Administrator verification prior to publishing courses or grading rubrics.
                </li>
                <li className="border-t border-white/10 pt-2.5">
                  <span className="font-semibold text-white">Admins:</span> Provisioned exclusively via
                  server-side governance endpoints.
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-slate-300">
              {health?.hasAdminAccount === false && (
                <div className="space-y-2">
                  <p className="text-teal-300 font-medium">
                    No Administrator account exists in this database yet.
                  </p>
                  <Link
                    to="/bootstrap-admin"
                    className="inline-flex items-center justify-center w-full min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md bg-[#0F766E] text-white hover:bg-[#0D9488]"
                  >
                    Initialize First Admin Account
                  </Link>
                </div>
              )}
              {health?.hasAdminAccount !== false && (
                <Link
                  to="/bootstrap-admin"
                  className="inline-block text-xs text-teal-300 hover:text-white underline underline-offset-4"
                >
                  Initial Administrator Provisioning Setup →
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
