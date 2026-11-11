import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/FormField';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, isSupabaseConfigured } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{
    tone: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters.';
    }
    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const res = await authService.updatePassword(newPassword);
    setIsSubmitting(false);

    if (!res.ok) {
      setStatus({
        tone: 'error',
        title: 'Password Update Failed',
        description: res.message,
      });
      return;
    }

    setStatus({
      tone: 'success',
      title: 'Password Updated',
      description: 'Your password has been updated. Redirecting you to sign in...',
    });
    setTimeout(() => navigate('/login'), 1500);
  };

  return (
    <div className="bg-slate-50 py-12 lg:py-16 px-4 sm:px-6 lg:px-8 min-h-full">
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <BrandMark />
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                Set New Password
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Complete password recovery for your authenticated portal session.
              </p>
            </div>
          </div>

          {!session && isSupabaseConfigured && (
            <StatusBanner
              tone="warning"
              title="Recovery Token Required"
              description="Open this page using the password reset link emailed by Supabase Auth, or sign in first from Settings."
            />
          )}

          {status && (
            <StatusBanner
              tone={status.tone}
              title={status.title}
              description={status.description}
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <TextField
              htmlFor="new-pw"
              label="New Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={errors.newPassword}
              placeholder="Minimum 8 characters"
            />
            <TextField
              htmlFor="confirm-new-pw"
              label="Confirm New Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              placeholder="Re-enter password"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting || !isSupabaseConfigured || !session}
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'Updating...' : 'Update Account Password'}</span>
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-200 text-sm text-slate-600">
            <Link to="/login" className="font-semibold text-[#0F766E] hover:text-[#0B1F3A]">
              ← Return to Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
