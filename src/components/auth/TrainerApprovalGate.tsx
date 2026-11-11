import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusBanner } from '../ui/StatusBanner';
import { useAuth } from '../../context/AuthContext';

export function TrainerApprovalGate({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  if (currentUser?.approvalStatus === 'approved') {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <StatusBanner
        tone="warning"
        title="Administrator Approval Required"
        description="Your Trainer account is currently marked as Pending verification. Update your domain credentials under Expertise and wait for an Administrator to approve your account before creating courses, uploading materials, authoring assessments, or grading cohorts."
      />

      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
              Prepare Your Accreditation Profile
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              While pending review, you can complete your institutional profile and submit domain
              credentials in PostgreSQL `trainer_expertise` for administrative review.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            to="/dashboard/trainer/expertise"
            className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53]"
          >
            Add Domain Expertise
          </Link>
          <Link
            to="/dashboard/trainer/profile"
            className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            Update Trainer Profile
          </Link>
        </div>
      </Card>
    </div>
  );
}
