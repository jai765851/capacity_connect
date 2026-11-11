import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DASHBOARD_PATHS, ROLE_LABELS, UserRole } from '../../types/auth';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProtectedRouteProps {
  requiredRole: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { currentUser, isSupabaseConfigured, authLoading, profileError, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <p className="font-mono text-xs text-[#0F766E]">Verifying Session</p>
          <p className="font-display text-lg font-semibold text-[#0B1F3A]">
            Authenticating portal workspace...
          </p>
        </Card>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 space-y-5">
          <div className="w-10 h-10 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-slate-900">
              Supabase Configuration Required
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              This protected {ROLE_LABELS[requiredRole]} workspace requires valid{' '}
              <span className="font-mono text-xs">VITE_SUPABASE_URL</span> and{' '}
              <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span> credentials and
              executed SQL migrations before authentication can complete.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] transition-colors whitespace-nowrap shrink-0"
            >
              Portal Sign In
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Return Home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 space-y-5">
          <div className="w-10 h-10 rounded-md bg-slate-100 text-[#0B1F3A] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-slate-900">
              {ROLE_LABELS[requiredRole]} Sign-In Required
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {profileError
                ? profileError
                : `You must authenticate with an active ${ROLE_LABELS[requiredRole]} account to access this workspace.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] transition-colors whitespace-nowrap shrink-0"
            >
              Sign In to Portal
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Register Account
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (currentUser.accountStatus === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 space-y-5">
          <div className="w-10 h-10 rounded-md bg-red-50 text-red-700 border border-red-200 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-slate-900">
              Account Suspended
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your organisational account is currently suspended. Contact your portal administrator
              for reactivation.
            </p>
          </div>
          <div className="pt-2">
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (currentUser.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 space-y-5">
          <div className="w-10 h-10 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-slate-900">
              Role Access Restricted
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account role is{' '}
              <span className="font-semibold text-slate-900">
                {ROLE_LABELS[currentUser.role]}
              </span>
              . Routes under{' '}
              <span className="font-semibold text-slate-900">
                {ROLE_LABELS[requiredRole]}
              </span>{' '}
              are restricted by PostgreSQL Row-Level Security and route access control.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to={ROLE_DASHBOARD_PATHS[currentUser.role]}
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] transition-colors whitespace-nowrap shrink-0"
            >
              Open {ROLE_LABELS[currentUser.role]} Dashboard
            </Link>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (currentUser.role === 'trainer' && currentUser.approvalStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 space-y-5">
          <div className="w-10 h-10 rounded-md bg-red-50 text-red-700 border border-red-200 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold text-slate-900">
              Trainer Application Declined
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your Trainer application for {currentUser.department || 'this portal'} was declined by
              an administrator. Contact institutional coordination to appeal or request Trainee access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-sm font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
            >
              Contact Coordination Desk
            </Link>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
