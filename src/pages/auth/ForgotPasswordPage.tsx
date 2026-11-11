import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/FormField';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

export function ForgotPasswordPage() {
  const { isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<{
    tone: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid institutional email address.');
      return;
    }
    setError(undefined);
    setIsSubmitting(true);
    const res = await authService.sendPasswordResetEmail(email);
    setIsSubmitting(false);

    setStatus({
      tone: res.ok ? 'success' : 'error',
      title: res.ok ? 'Password Recovery Dispatched' : 'Recovery Request Failed',
      description: res.message,
    });
  };

  return (
    <div className="bg-slate-50 py-12 lg:py-16 px-4 sm:px-6 lg:px-8 min-h-full">
      <div className="max-w-lg mx-auto space-y-6">
        {!isSupabaseConfigured && (
          <StatusBanner
            tone="warning"
            title="Supabase Auth Required"
            description="Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable email-based password recovery."
          />
        )}

        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <BrandMark />
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                Reset Account Password
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Enter your registered institutional email to receive a password recovery link.
              </p>
            </div>
          </div>

          {status && (
            <StatusBanner
              tone={status.tone}
              title={status.title}
              description={status.description}
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <TextField
              htmlFor="reset-email"
              label="Registered Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
              placeholder="name@organisation.gov.in"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting || !isSupabaseConfigured}
            >
              <Mail className="w-4 h-4" />
              <span>{isSubmitting ? 'Sending Link...' : 'Send Password Reset Link'}</span>
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
            <Link to="/login" className="font-semibold text-[#0F766E] hover:text-[#0B1F3A]">
              ← Back to Sign In
            </Link>
            <Link to="/register" className="text-slate-600 hover:text-[#0B1F3A]">
              Create Account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
