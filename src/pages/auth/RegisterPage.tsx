import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, UserPlus } from 'lucide-react';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SelectField, TextField } from '../../components/ui/FormField';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { ROLE_DASHBOARD_PATHS } from '../../types/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const { currentUser, isSupabaseConfigured, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [requestedRole, setRequestedRole] = useState<'trainee' | 'trainer'>('trainee');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'info' | 'warning' | 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);
  const [awaitingVerificationEmail, setAwaitingVerificationEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (currentUser) {
      navigate(ROLE_DASHBOARD_PATHS[currentUser.role], { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid institutional email address.';
    }
    if (!department.trim()) nextErrors.department = 'Department or unit is required.';
    if (!designation.trim()) nextErrors.designation = 'Role designation is required.';
    if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const result = await authService.registerAccount({
      fullName,
      email,
      department,
      designation,
      requestedRole,
      password,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setStatusBanner({
        tone: result.requiresConfiguration ? 'warning' : 'error',
        title: result.requiresConfiguration ? 'Supabase Configuration Pending' : 'Registration Error',
        description: result.message,
      });
      return;
    }

    if (result.requiresEmailVerification) {
      setAwaitingVerificationEmail(email.trim());
      setStatusBanner({
        tone: 'success',
        title: 'Verification Email Dispatched',
        description: result.message,
      });
      return;
    }

    await refreshProfile();
    if (result.user) {
      navigate(ROLE_DASHBOARD_PATHS[result.user.role], { replace: true });
    }
  };

  const handleResend = async () => {
    if (!awaitingVerificationEmail) return;
    setIsResending(true);
    const res = await authService.resendVerificationEmail(awaitingVerificationEmail);
    setIsResending(false);
    setStatusBanner({
      tone: res.ok ? 'success' : 'error',
      title: res.ok ? 'Verification Link Resent' : 'Resend Failed',
      description: res.message,
    });
  };

  return (
    <div className="bg-slate-50 py-12 lg:py-16 px-4 sm:px-6 lg:px-8 min-h-full">
      <div className="max-w-2xl mx-auto space-y-6">
        {!isSupabaseConfigured && (
          <StatusBanner
            tone="warning"
            title="Supabase Auth Configuration Required"
            description="Public account creation requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment and executed SQL migrations 001–006."
          />
        )}

        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <BrandMark />
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                Organisational Account Registration
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Create a Trainee or Trainer profile mapped to your department. Administrator
                accounts cannot be self-registered publicly.
              </p>
            </div>
          </div>

          {statusBanner && (
            <StatusBanner
              tone={statusBanner.tone}
              title={statusBanner.title}
              description={statusBanner.description}
              action={
                awaitingVerificationEmail ? (
                  <Button variant="outline" size="sm" disabled={isResending} onClick={handleResend}>
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isResending ? 'Sending...' : 'Resend Email'}</span>
                  </Button>
                ) : undefined
              }
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="reg-fullname"
                label="Full Name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={errors.fullName}
                placeholder="e.g. Priya Deshpande"
              />
              <TextField
                htmlFor="reg-email"
                label="Institutional Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="name@organisation.gov.in"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="reg-department"
                label="Department / Directorate"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                error={errors.department}
                placeholder="e.g. Digital Infrastructure Division"
              />
              <TextField
                htmlFor="reg-designation"
                label="Designation"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                error={errors.designation}
                placeholder="e.g. Assistant Systems Officer"
              />
            </div>

            <SelectField
              htmlFor="reg-role"
              label="Account Role"
              required
              value={requestedRole}
              onChange={(e) => setRequestedRole(e.target.value as 'trainee' | 'trainer')}
              helperText="Trainee accounts activate upon verification. Trainer applications enter Pending status until approved by an Administrator."
            >
              <option value="trainee">Trainee (Organisational Personnel)</option>
              <option value="trainer">Trainer (Subject-Matter Assessor — Requires Admin Approval)</option>
            </SelectField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="reg-password"
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="Minimum 8 characters"
              />
              <TextField
                htmlFor="reg-confirm"
                label="Confirm Password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                placeholder="Re-enter password"
              />
            </div>

            <div className="pt-3">
              <Button
                type="submit"
                variant="teal"
                size="lg"
                fullWidth
                disabled={isSubmitting || !isSupabaseConfigured}
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Creating Account...' : 'Register Organisational Account'}</span>
              </Button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>Already have verified portal credentials?</span>
            <Link
              to="/login"
              className="font-semibold text-[#0B1F3A] hover:text-[#0F766E] transition-colors"
            >
              Return to Sign In →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
