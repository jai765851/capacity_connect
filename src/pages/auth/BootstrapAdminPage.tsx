import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/FormField';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { fetchServerHealthStatus, ServerHealthStatus } from '../../config/env';
import { databaseService } from '../../services/databaseService';

export function BootstrapAdminPage() {
  const [health, setHealth] = useState<ServerHealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Institutional Capacity Directorate');
  const [designation, setDesignation] = useState('Portal Administrator');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{
    tone: 'success' | 'error' | 'warning';
    title: string;
    description: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reloadHealth = async () => {
    setLoadingHealth(true);
    const res = await fetchServerHealthStatus();
    setHealth(res);
    setLoadingHealth(false);
  };

  useEffect(() => {
    reloadHealth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!bootstrapSecret.trim()) nextErrors.bootstrapSecret = 'Bootstrap secret is required.';
    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Valid institutional email is required.';
    }
    if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await databaseService.bootstrapInitialAdmin({
        bootstrapSecret: bootstrapSecret.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        department: department.trim(),
        designation: designation.trim(),
      });
      setStatus({
        tone: 'success',
        title: 'Administrator Account Initialized',
        description: `${result.message} Email: ${result.email}. Sign in now via the portal login page.`,
      });
      setBootstrapSecret('');
      setPassword('');
      await reloadHealth();
    } catch (err) {
      setStatus({
        tone: 'error',
        title: 'Bootstrap Request Rejected',
        description: err instanceof Error ? err.message : 'Unable to create admin account.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const serverReady =
    Boolean(health?.supabaseAdminConfigured) &&
    Boolean(health?.bootstrapConfigured) &&
    Boolean(health?.databaseSchemaReady);

  return (
    <div className="bg-slate-50 py-12 lg:py-16 px-4 sm:px-6 lg:px-8 min-h-full">
      <div className="max-w-2xl mx-auto space-y-6">
        {!loadingHealth && !serverReady && (
          <StatusBanner
            tone="warning"
            title="Server Environment Setup Incomplete"
            description="Initial administrator creation requires VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_BOOTSTRAP_SECRET on the server, and SQL migrations 001–006 executed in Supabase."
          />
        )}

        {health?.hasAdminAccount === true && (
          <StatusBanner
            tone="info"
            title="Initial Bootstrap Locked"
            description="An administrator account already exists in public.profiles. Additional admins must be created from User Management while signed in as an active Administrator."
          />
        )}

        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <BrandMark />
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                Initial Administrator Bootstrap
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                One-time server-verified provisioning for the first portal Administrator account.
                Self-registration never creates Admin accounts.
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
              htmlFor="boot-secret"
              label="Server Bootstrap Secret (ADMIN_BOOTSTRAP_SECRET)"
              type="password"
              required
              value={bootstrapSecret}
              onChange={(e) => setBootstrapSecret(e.target.value)}
              error={errors.bootstrapSecret}
              placeholder="Enter secret configured on server"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="boot-name"
                label="Administrator Full Name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={errors.fullName}
                placeholder="e.g. Dr. Kavita Sharma"
              />
              <TextField
                htmlFor="boot-email"
                label="Official Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="admin@organisation.gov.in"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="boot-dept"
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
              <TextField
                htmlFor="boot-desig"
                label="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>

            <TextField
              htmlFor="boot-pw"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="Minimum 8 characters"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting || !serverReady || health?.hasAdminAccount === true}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Provisioning...' : 'Provision Initial Admin'}</span>
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
            <Link to="/login" className="font-semibold text-[#0F766E] hover:text-[#0B1F3A]">
              ← Return to Sign In
            </Link>
            <Link to="/" className="text-slate-600 hover:text-[#0B1F3A]">
              Portal Home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
