import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Printer, Trophy } from 'lucide-react';
import { formatPercent, SECONDARY_PART_POINTS, type SheetKind, type StudentResult } from '@/lib/grading';
import type { Student } from '@/lib/types';
import { classLabel, SEMESTERS, semesterLabel } from '@/lib/school';
import { gradeBadgeClass, gradeBarClass, secondaryButtonClass } from '@/lib/styles';
import { StudentPhoto } from '@/components/report/StudentPhoto';
import { printReport } from '@/lib/printReport';

const schoolLogoUrl = `${import.meta.env.BASE_URL}png.png`;

export function StudentReportCard({
  student,
  result,
  rank,
  classSize,
  semester,
  schoolYear,
  className,
  sheet,
}: {
  student: Student;
  result: StudentResult;
  rank: number | null;
  classSize: number;
  semester: number;
  schoolYear: number;
  className?: string;
  sheet: SheetKind;
}) {
  const [animated, setAnimated] = useState(false);
  const dates = SEMESTERS.find((item) => item.value === semester)?.dates;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <article className="student-report-card overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)]">
      <header className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 px-6 pb-7 pt-14 text-white sm:px-8 sm:pb-9 sm:pt-16">
        <div className="report-school-logo-wrap absolute left-1/2 top-2 z-10 -translate-x-1/2">
          <img src={schoolLogoUrl} alt="Faafu Atoll School logo" className="report-school-logo h-16 w-16 object-contain" />
        </div>
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <StudentPhoto fullName={student.full_name} photoUrl={student.photo_url} className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" textClass="text-xl" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Grade analysis · {semesterLabel(semester)}</p>
              <p className="mt-4 text-sm font-medium text-blue-100">
                {className ?? classLabel(student.class_name)} · Index No {student.roll_no || '-'}
              </p>
              <h2 className="mt-1 font-serif text-3xl font-bold leading-tight sm:text-4xl">{student.full_name}</h2>
              <p className="mt-1 text-sm text-blue-100">{dates ? `Assessment window · ${dates}, ${schoolYear}` : `Assessment window · ${schoolYear}`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${gradeBadgeClass(result.finalGrade)}`}>
              {result.finalGrade} final
            </span>
            <button type="button" onClick={() => printReport(`Faafu Atoll School - ${student.full_name} - ${schoolYear} - Semester ${semester} Report`)} className={`${secondaryButtonClass} border-white/30 bg-white/10 text-white hover:bg-white/20 print:hidden`}>
              <Printer className="h-4 w-4" aria-hidden />
              Print report
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 bg-gradient-to-b from-blue-50 to-white p-4 sm:grid-cols-4 sm:p-5">
        <Stat label="Total" value={formatPercent(result.total)} />
        <Stat label="Average" value={formatPercent(result.average)} />
        <Stat label="Final grade" value={result.finalGrade} badge />
        <Stat label="Class rank" value={rank ? `${rank} of ${classSize}` : '-'} icon={rank === 1 ? <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> : null} />
      </div>

      <section className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Performance</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">Subject results</h3>
          </div>
          <p className="hidden text-sm text-slate-500 sm:block">A quick view of every subject and assessment.</p>
        </div>
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {result.subjects.map((subject) => {
            const width = Math.min(Math.max(subject.percent ?? 0, 0), 100);
            return (
              <li key={subject.subjectId} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">{subject.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{formatPercent(subject.percent)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${gradeBadgeClass(subject.grade)}`}>
                      {subject.grade}
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </span>
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80" role="img" aria-label={`${subject.name} ${formatPercent(subject.percent)}`}>
                  <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${gradeBarClass(subject.grade)}`} style={{ width: animated ? `${width}%` : '0%' }} />
                </div>
                {sheet === 'secondary' && subject.term.max > 0 && (
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Unit tests {subject.unit.points.toFixed(2)} / {SECONDARY_PART_POINTS.unit} · Term test {subject.term.points.toFixed(2)} / {SECONDARY_PART_POINTS.term}
                  </p>
                )}
                {subject.assessments.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">{subject.assessments.map((item) => `${item.name}: ${item.mark ?? '-'} / ${item.max}`).join('   ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}

function Stat({ label, value, badge = false, icon = null }: { label: string; value: string; badge?: boolean; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-sm sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {badge ? <span className={`rounded-full px-3 py-1 text-lg font-bold ring-1 ring-inset ${gradeBadgeClass(value)}`}>{value}</span> : <span className="text-2xl font-bold tabular-nums text-slate-900">{value}</span>}
        {icon}
      </div>
    </div>
  );
}
