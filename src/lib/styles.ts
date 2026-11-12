export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const cardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export function gradeBadgeClass(grade: string): string {
  if (grade === 'FA') return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20';
  if (grade === 'MA') return 'bg-sky-100 text-sky-800 ring-sky-600/20';
  if (grade === 'A*') return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20';
  if (grade === 'A') return 'bg-amber-100 text-amber-800 ring-amber-600/20';
  if (grade === 'B') return 'bg-blue-100 text-blue-800 ring-blue-600/20';
  if (grade === 'C') return 'bg-cyan-100 text-cyan-800 ring-cyan-600/20';
  if (grade === 'D') return 'bg-orange-100 text-orange-800 ring-orange-600/20';
  if (grade === 'E') return 'bg-rose-100 text-rose-800 ring-rose-600/20';
  if (grade === 'U') return 'bg-red-100 text-red-800 ring-red-600/20';
  return 'bg-slate-100 text-slate-500 ring-slate-400/20';
}

export function gradeBarClass(grade: string): string {
  if (grade === 'FA') return 'bg-emerald-500';
  if (grade === 'MA') return 'bg-sky-600';
  if (grade === 'A*') return 'bg-emerald-500';
  if (grade === 'A') return 'bg-amber-500';
  if (grade === 'B') return 'bg-blue-600';
  if (grade === 'C') return 'bg-cyan-500';
  if (grade === 'D') return 'bg-orange-500';
  if (grade === 'E') return 'bg-rose-500';
  if (grade === 'U') return 'bg-red-600';
  return 'bg-slate-300';
}
