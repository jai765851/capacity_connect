import React from 'react';

interface BaseFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

interface TextInputProps
  extends BaseFieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {}

interface SelectInputProps
  extends BaseFieldProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  children: React.ReactNode;
}

interface TextareaInputProps
  extends BaseFieldProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {}

const INPUT_BASE =
  'w-full min-h-[42px] rounded-md border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]';

export function TextField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  className = '',
  ...props
}: TextInputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </label>
      <input
        id={htmlFor}
        required={required}
        className={`${INPUT_BASE} ${
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300'
        } ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}

export function SelectField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  className = '',
  children,
  ...props
}: SelectInputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </label>
      <select
        id={htmlFor}
        required={required}
        className={`${INPUT_BASE} ${
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300'
        } ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}

export function TextareaField({
  label,
  htmlFor,
  error,
  helperText,
  required,
  className = '',
  ...props
}: TextareaInputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </label>
      <textarea
        id={htmlFor}
        required={required}
        className={`w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] ${
          error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-slate-300'
        } ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
