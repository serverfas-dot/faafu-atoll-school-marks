import { formatPercent } from '@/lib/grading';
import type { OutcomeSummary } from '@/lib/reporting';

export function OutcomeBar({ summary }: { summary: OutcomeSummary }) {
  const passWidth = summary.total === 0 ? 0 : (summary.pass / summary.total) * 100;
  const failWidth = summary.total === 0 ? 0 : (summary.fail / summary.total) * 100;

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${formatPercent(summary.passRate)} pass and ${formatPercent(summary.failRate)} fail`}>
        <div className="bg-emerald-500 transition-[width] duration-700" style={{ width: `${passWidth}%` }} />
        <div className="bg-rose-400 transition-[width] duration-700" style={{ width: `${failWidth}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium">
        <span className="text-emerald-700">Pass {formatPercent(summary.passRate)}</span>
        <span className="text-rose-700">Fail {formatPercent(summary.failRate)}</span>
      </div>
    </div>
  );
}
