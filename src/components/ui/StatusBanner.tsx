import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface StatusBannerProps {
  tone: 'info' | 'warning' | 'success' | 'error';
  title: string;
  description: string;
  action?: React.ReactNode;
}

const TONE_MAP = {
  info: {
    container: 'bg-slate-50 border border-slate-200 text-slate-900',
    icon: Info,
    iconColor: 'text-[#0B1F3A]',
    label: 'Notice',
  },
  warning: {
    container: 'bg-amber-50/70 border border-amber-200 text-slate-900',
    icon: AlertCircle,
    iconColor: 'text-amber-700',
    label: 'Attention Required',
  },
  success: {
    container: 'bg-teal-50/70 border border-teal-200 text-slate-900',
    icon: CheckCircle2,
    iconColor: 'text-[#0F766E]',
    label: 'Confirmed',
  },
  error: {
    container: 'bg-red-50/80 border border-red-200 text-slate-900',
    icon: XCircle,
    iconColor: 'text-red-700',
    label: 'Error',
  },
};

export function StatusBanner({ tone, title, description, action }: StatusBannerProps) {
  const style = TONE_MAP[tone];
  const Icon = style.icon;

  return (
    <div className={`rounded-lg p-4 sm:p-5 ${style.container}`} role="status">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} strokeWidth={1.75} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              <span className="sr-only">{style.label}: </span>
              {title}
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
