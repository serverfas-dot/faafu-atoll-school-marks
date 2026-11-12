import { BarChart3, Medal, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { OutcomeBar } from '@/components/report/OutcomeBar';
import { SelectField } from '@/components/ui';
import { formatPercent, type AssessmentResult, type SheetKind, type StudentResult } from '@/lib/grading';
import { isPassingGrade, type OutcomeSummary } from '@/lib/reporting';
import { semesterLabel } from '@/lib/school';
import { cardClass, gradeBadgeClass, gradeBarClass } from '@/lib/styles';
import type { Student, Subject } from '@/lib/types';

type SubjectEntry = {
  student: Student;
  subject: NonNullable<StudentResult['subjects'][number]>;
};

type AssessmentSummary = {
  id: string;
  name: string;
  average: number | null;
  passRate: number;
  entered: number;
};

export function GradeSubjectAnalysis({
  className,
  semester,
  schoolYear,
  sheet,
  students,
  subjects,
  results,
  subjectId,
  onSubjectChange,
}: {
  className: string;
  semester: number;
  schoolYear: number;
  sheet: SheetKind;
  students: Student[];
  subjects: Subject[];
  results: StudentResult[];
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
}) {
  const selectedSubject = subjects.find((subject) => subject.id === subjectId) ?? subjects[0];
  const studentById = new Map(students.map((student) => [student.id, student]));
  const subjectEntries: SubjectEntry[] = results.flatMap((result) => {
    const student = studentById.get(result.studentId);
    const subject = result.subjects.find((item) => item.subjectId === selectedSubject?.id);
    return student && subject ? [{ student, subject }] : [];
  });
  const gradedEntries = subjectEntries.filter((entry) => entry.subject.percent !== null);
  const average = averageOf(gradedEntries.map((entry) => entry.subject.percent));
  const pass = gradedEntries.filter((entry) => isPassingGrade(entry.subject.grade, sheet)).length;
  const summary = createSummary(pass, gradedEntries.length - pass);
  const topEntry = [...gradedEntries].sort((a, b) => (b.subject.percent ?? -1) - (a.subject.percent ?? -1))[0];
  const distribution = buildDistribution(gradedEntries.map((entry) => entry.subject.grade), sheet);
  const assessmentSummaries = buildAssessmentSummaries(subjectEntries, sheet);

  if (!selectedSubject) {
    return <div className={`${cardClass} p-6`}><p className="text-sm text-slate-600">No subjects are available for this grade.</p></div>;
  }

  return (
    <section className="space-y-6">
      <div className={`${cardClass} overflow-hidden`}>
        <div className="bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 px-5 py-6 text-white sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Grade subject analysis</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">{selectedSubject.name}</h2>
              <p className="mt-1 text-sm text-blue-100">{className} · {schoolYear} · {semesterLabel(semester)} · {sheet === 'secondary' ? 'Secondary grading' : 'Primary grading'}</p>
            </div>
            <div className="w-full sm:w-72">
              <SelectField label="Subject" value={selectedSubject.id} onChange={onSubjectChange}>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </SelectField>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalysisMetric label="Subject average" value={formatPercent(average)} detail="Across entered marks" icon={<BarChart3 className="h-5 w-5" />} />
        <AnalysisMetric label="Pass rate" value={formatPercent(summary.passRate)} detail={`${summary.pass} of ${summary.total} assessed`} icon={<TrendingUp className="h-5 w-5" />} />
        <AnalysisMetric label="Highest result" value={formatPercent(topEntry?.subject.percent ?? null)} detail={topEntry?.student.full_name ?? 'No marks entered'} icon={<Medal className="h-5 w-5" />} />
        <AnalysisMetric label="Students assessed" value={String(gradedEntries.length)} detail={`of ${students.length} students`} icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className={`${cardClass} p-5 sm:p-6`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Subject outcome</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">Pass and fail overview</h3>
            </div>
            <p className="text-sm font-semibold text-slate-500">{summary.total} assessed</p>
          </div>
          <div className="mt-6"><OutcomeBar summary={summary} /></div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800"><p className="text-xs font-semibold uppercase tracking-wide">Passed</p><p className="mt-1 text-2xl font-bold">{summary.pass}</p></div>
            <div className="rounded-2xl bg-rose-50 p-4 text-rose-800"><p className="text-xs font-semibold uppercase tracking-wide">Needs support</p><p className="mt-1 text-2xl font-bold">{summary.fail}</p></div>
          </div>
        </div>

        <div className={`${cardClass} p-5 sm:p-6`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Grade distribution</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Results by grade</h3>
          {distribution.length === 0 ? <p className="mt-6 text-sm text-slate-500">No subject marks have been entered yet.</p> : <div className="mt-6 space-y-4">{distribution.map((item) => <div key={item.grade}><div className="mb-1.5 flex items-center justify-between text-sm"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${gradeBadgeClass(item.grade)}`}>{item.grade}</span><span className="font-semibold text-slate-700">{item.count} · {formatPercent(item.percentage)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${gradeBarClass(item.grade)}`} style={{ width: `${item.percentage}%` }} /></div></div>)}</div>}
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Assessment breakdown</p><h3 className="mt-1 text-xl font-bold text-slate-900">Paper results for {selectedSubject.name}</h3></div>
        {assessmentSummaries.length === 0 ? <p className="p-5 text-sm text-slate-500">No assessments have been configured for this subject.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Assessment</th><th className="px-5 py-3">Average</th><th className="px-5 py-3">Pass rate</th><th className="px-5 py-3">Entered</th></tr></thead><tbody>{assessmentSummaries.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-3 font-medium text-slate-900">{item.name}</td><td className="px-5 py-3 text-sm font-semibold tabular-nums text-slate-800">{formatPercent(item.average)}</td><td className="px-5 py-3 text-sm font-semibold text-emerald-700">{formatPercent(item.passRate)}</td><td className="px-5 py-3 text-sm text-slate-600">{item.entered} of {students.length}</td></tr>)}</tbody></table></div>}
      </div>
    </section>
  );
}

function AnalysisMetric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p><p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">{detail}</p></div><span className="rounded-xl bg-blue-50 p-2.5 text-blue-800">{icon}</span></div></article>;
}

function buildAssessmentSummaries(entries: SubjectEntry[], sheet: SheetKind): AssessmentSummary[] {
  const definitions = entries[0]?.subject.assessments ?? [];
  return definitions.map((definition) => {
    const assessments = entries
      .map((entry) => entry.subject.assessments.find((assessment) => assessment.assessmentId === definition.assessmentId))
      .filter((assessment): assessment is AssessmentResult => assessment !== undefined && assessment.percent !== null);
    const pass = assessments.filter((assessment) => isPassingGrade(assessment.grade, sheet)).length;
    return { id: definition.assessmentId, name: definition.name, average: averageOf(assessments.map((assessment) => assessment.percent)), passRate: assessments.length === 0 ? 0 : (pass / assessments.length) * 100, entered: assessments.length };
  });
}

function buildDistribution(grades: string[], sheet: SheetKind) {
  const order = sheet === 'secondary' ? ['A*', 'A', 'B', 'C', 'D', 'E', 'U'] : ['FA', 'MA', 'A', '-'];
  return order.map((grade) => ({ grade, count: grades.filter((item) => item === grade).length, percentage: grades.length === 0 ? 0 : (grades.filter((item) => item === grade).length / grades.length) * 100 })).filter((item) => item.count > 0);
}

function averageOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0) / present.length;
}

function createSummary(pass: number, fail: number): OutcomeSummary {
  const total = pass + fail;
  return { pass, fail, total, passRate: total === 0 ? 0 : (pass / total) * 100, failRate: total === 0 ? 0 : (fail / total) * 100 };
}
