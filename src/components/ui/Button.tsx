import React from 'react';

type ButtonVariant = 'primary' | 'teal' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#0B1F3A] text-white hover:bg-[#122E53] border border-[#0B1F3A] focus-visible:ring-[#0B1F3A]',
  teal:
    'bg-[#0F766E] text-white hover:bg-[#0D9488] border border-[#0F766E] focus-visible:ring-[#0F766E]',
  outline:
    'bg-white text-slate-900 hover:bg-slate-50 border border-slate-300 focus-visible:ring-slate-500',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent focus-visible:ring-slate-500',
  danger:
    'bg-white text-red-700 hover:bg-red-50 border border-red-300 focus-visible:ring-red-600',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[40px] px-4 py-2 text-xs font-medium',
  md: 'min-h-[42px] px-5 py-2.5 text-sm font-medium',
  lg: 'min-h-[46px] px-6 py-3 text-sm font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
        VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
