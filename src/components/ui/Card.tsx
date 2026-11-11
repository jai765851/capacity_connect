import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  padded?: boolean;
  tone?: 'white' | 'subtle' | 'navy';
}

const TONE_CLASSES: Record<NonNullable<CardProps['tone']>, string> = {
  white: 'bg-white border border-slate-200 text-slate-900',
  subtle: 'bg-slate-50 border border-slate-200 text-slate-900',
  navy: 'bg-[#0B1F3A] border border-[#122E53] text-white',
};

export function Card({
  children,
  className = '',
  padded = true,
  tone = 'white',
}: CardProps) {
  return (
    <div
      className={`rounded-lg ${TONE_CLASSES[tone]} ${padded ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
