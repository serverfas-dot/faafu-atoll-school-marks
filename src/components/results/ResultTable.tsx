import type { Student, Subject } from '@/lib/types';
import type { StudentResult } from '@/lib/grading';
import { formatPercent } from '@/lib/grading';
import { cardClass, gradeBadgeClass } from '@/lib/styles';

export type ResultRow = {
  student: Student;
  result: StudentResult;
  rank: number | null;
};

const cellClass = 'whitespace-nowrap px-3 py-2.5 text-sm tabular-nums';
const headClass = 'whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600';

function GradeCell({ grade }: { grade: string }) {
  return (
    <span className={`inline-flex min-w-[2.75rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${gradeBadgeClass(grade)}`}>
      {grade}
    </span>
  );
}

export function ResultTable({ subjects, rows, removeFinalPercent }: { subjects: Subject[]; rows: ResultRow[]; removeFinalPercent: boolean }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th rowSpan={2} className={`${headClass} sticky left-0 z-20 w-[80px] min-w-[80px] bg-slate-50`}>Index No</th>
            <th rowSpan={2} className={`${headClass} sticky left-[80px] z-20 min-w-[220px] border-r border-slate-200 bg-slate-50`}>Name</th>
            {subjects.map((subject) => (
              <th key={subject.id} colSpan={2} className={`${headClass} border-l border-slate-200 text-center text-slate-800`}>
                {subject.name}
              </th>
            ))}
            <th rowSpan={2} className={`${headClass} border-l border-slate-200`}>Total</th>
            <th rowSpan={2} className={headClass}>Average</th>
            <th rowSpan={2} className={headClass}>Final grade</th>
            <th rowSpan={2} className={headClass}>Rank</th>
          </tr>
          <tr className="border-b border-slate-200">
            {subjects.map((subject) => (
              <FragmentHeader key={subject.id} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const surfaceClass = rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white';
            return (
            <tr key={row.student.id} className={`group border-b border-slate-100 ${surfaceClass} hover:bg-blue-50`}>
              <td className={`${cellClass} sticky left-0 z-10 w-[80px] min-w-[80px] ${surfaceClass} text-slate-600 group-hover:bg-blue-50`}>{row.student.roll_no || '-'}</td>
              <td className={`${cellClass} sticky left-[80px] z-10 min-w-[220px] border-r border-slate-200 ${surfaceClass} font-medium text-slate-900 group-hover:bg-blue-50`}>{row.student.full_name}</td>
              {row.result.subjects.map((subject) => (
                <SubjectCells key={subject.subjectId} percent={subject.percent} grade={subject.grade} />
              ))}
              <td className={`${cellClass} border-l border-slate-200 font-semibold text-slate-900`}>{formatFinalValue(row.result.total, removeFinalPercent)}</td>
              <td className={`${cellClass} font-semibold text-slate-900`}>{formatFinalValue(row.result.average, removeFinalPercent)}</td>
              <td className={cellClass}>
                <GradeCell grade={row.result.finalGrade} />
              </td>
              <td className={`${cellClass} font-bold text-blue-800`}>{row.rank ?? '-'}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatFinalValue(value: number | null, removePercent: boolean): string {
  const formatted = formatPercent(value);
  return removePercent ? formatted.replace('%', '') : formatted;
}

function FragmentHeader() {
  return (
    <>
      <th className={`${headClass} border-l border-slate-200`}>%</th>
      <th className={headClass}>Grade</th>
    </>
  );
}

function SubjectCells({ percent, grade }: { percent: number | null; grade: string }) {
  return (
    <>
      <td className={`${cellClass} border-l border-slate-100 text-slate-800`}>{formatPercent(percent)}</td>
      <td className={cellClass}>
        <GradeCell grade={grade} />
      </td>
    </>
  );
}
