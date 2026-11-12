import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/styles';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-blue-700" aria-hidden />
      {label ?? 'Loading...'}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'info' | 'success'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      >
        {children}
      </select>
    </label>
  );
}

export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = true,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        className={inputClass}
      />
    </label>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={`${cardClass} flex flex-col items-center px-6 py-14 text-center`}>
      <p className="text-lg font-semibold text-slate-800">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}
