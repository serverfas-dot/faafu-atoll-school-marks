import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, MinusCircle, Users } from 'lucide-react';
import { StudentPhoto } from '@/components/report/StudentPhoto';
import { SelectField } from '@/components/ui';
import { type AssessmentResult, type SheetKind, type StudentResult } from '@/lib/grading';
import { isPassingGrade } from '@/lib/reporting';
import { cardClass } from '@/lib/styles';
import type { Assessment, Student, Subject } from '@/lib/types';

type PerformanceStatus = 'pass' | 'fail' | 'exempted' | 'not-entered';

type AssessmentSeries = {
  name: string;
  sourceName: string;
  sortOrder: number;
  color: string;
  lightColor: string;
};

type AssessmentMetric = {
  series: AssessmentSeries;
  average: number | null;
  pass: number;
  fail: number;
  exempted: number;
  notEntered: number;
};

type SubjectMetric = {
  subject: Subject;
  assessments: AssessmentMetric[];
};

type StudentMetric = {
  student: Student;
  pass: number;
  fail: number;
  exempted: number;
  notEntered: number;
};

const SERIES_COLORS = [
  { color: 'bg-blue-600', lightColor: 'bg-blue-100' },
  { color: 'bg-red-500', lightColor: 'bg-red-100' },
  { color: 'bg-amber-500', lightColor: 'bg-amber-100' },
  { color: 'bg-emerald-500', lightColor: 'bg-emerald-100' },
  { color: 'bg-cyan-500', lightColor: 'bg-cyan-100' },
  { color: 'bg-orange-500', lightColor: 'bg-orange-100' },
];

export function GradePerformance({
  className,
  semester,
  schoolYear,
  sheet,
  students,
  subjects,
  assessments,
  results,
}: {
  className: string;
  semester: number;
  schoolYear: number;
  sheet: SheetKind;
  students: Student[];
  subjects: Subject[];
  assessments: Assessment[];
  results: StudentResult[];
}) {
  const series = useMemo(() => buildSeries(assessments, semester), [assessments, semester]);
  const [assessmentName, setAssessmentName] = useState('');
  const activeSeries = series.find((item) => item.name === assessmentName) ?? series[0];
  const subjectMetrics = useMemo(
    () => buildSubjectMetrics(subjects, series, results, sheet),
    [results, series, sheet, subjects],
  );
  const studentMetrics = useMemo(
    () => buildStudentMetrics(students, series, results, sheet),
    [results, series, sheet, students],
  );
  const selectedSubjectMetrics = useMemo(
    () => subjectMetrics.map((item) => ({ ...item, assessments: activeSeries ? item.assessments.filter((assessment) => assessment.series.name === activeSeries.name) : [] })),
    [activeSeries, subjectMetrics],
  );
  const totals = useMemo(
    () => subjectMetrics.flatMap((item) => item.assessments).reduce(
      (summary, item) => ({
        pass: summary.pass + item.pass,
        fail: summary.fail + item.fail,
        exempted: summary.exempted + item.exempted,
        notEntered: summary.notEntered + item.notEntered,
      }),
      { pass: 0, fail: 0, exempted: 0, notEntered: 0 },
    ),
    [subjectMetrics],
  );
  const entered = totals.pass + totals.fail;
  const passRate = entered === 0 ? 0 : (totals.pass / entered) * 100;

  return (
    <section className="space-y-6">
      <div className={`${cardClass} overflow-hidden`}>
        <div className="bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 px-5 py-6 text-white sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Grade performance</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="mt-2 text-2xl font-bold">Assessment pass and fail performance</h2>
              <p className="mt-1 text-sm text-blue-100">{className} · {schoolYear} · Semester {semester} · {sheet === 'secondary' ? 'Secondary grading' : 'Primary grading'}</p>
            </div>
            <div className="w-full lg:w-72">
              <SelectField label="Assessment" value={activeSeries?.name ?? ''} onChange={setAssessmentName} className="[&>span]:text-white">
                {series.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </SelectField>
            </div>
          </div>
        </div>
      </div>

      {series.length === 0 ? (
        <div className={`${cardClass} p-6 text-sm text-slate-600`}>No assessments are configured for this grade and semester.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PerformanceMetric label="Students shown" value={String(studentMetrics.length)} detail="Every student in the grade" icon={<Users className="h-5 w-5" />} tone="blue" />
            <PerformanceMetric label="Papers passed" value={String(totals.pass)} detail={`${formatNumber(passRate)}% of entered papers`} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
            <PerformanceMetric label="Papers failed" value={String(totals.fail)} detail="Needs support" icon={<CircleAlert className="h-5 w-5" />} tone="rose" />
            <PerformanceMetric label="Not counted" value={String(totals.exempted + totals.notEntered)} detail={`${totals.exempted} exempted · ${totals.notEntered} not entered`} icon={<MinusCircle className="h-5 w-5" />} tone="slate" />
          </div>

          {activeSeries && <AssessmentBarChart subjects={selectedSubjectMetrics} assessment={activeSeries} />}

          <div className={`${cardClass} p-5 sm:p-6`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Pass and fail report</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">All subjects and assessments</h3>
                <p className="mt-1 text-sm text-slate-500">The graph shows pass, fail, and exemption percentages for the selected assessment across every subject.</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <Legend color="bg-emerald-500" label="Pass" />
                <Legend color="bg-rose-400" label="Fail" />
                <Legend color="bg-amber-400" label="MC / OL / AB" />
                <Legend color="bg-slate-300" label="Not entered" />
              </div>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Subject</th>{series.map((item) => <th key={item.name} className="px-5 py-3">{item.name}</th>)}</tr>
                </thead>
                <tbody>
                  {subjectMetrics.map((item) => (
                    <tr key={item.subject.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">{item.subject.name}</td>
                      {item.assessments.map((assessment) => <AssessmentDetailCell key={assessment.series.name} metric={assessment} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <StudentPassFailTable metrics={studentMetrics} />
        </>
      )}
    </section>
  );
}

function AssessmentBarChart({ subjects, assessment }: { subjects: SubjectMetric[]; assessment: AssessmentSeries }) {
  return (
    <section className={`${cardClass} overflow-hidden p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{assessment.name} report</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Pass and fail percentage by subject</h3>
          <p className="mt-1 text-sm text-slate-500">Each subject compares passed, failed, exempted, and not-entered students.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-700">
          <Legend color="bg-blue-600" label="Pass" />
          <Legend color="bg-red-500" label="Fail" />
          <Legend color="bg-amber-500" label="MC / OL / AB" />
          <Legend color="bg-slate-400" label="Not entered" />
        </div>
      </div>

      <div className="mt-8 max-w-full overflow-x-auto pb-3">
        <div className="min-w-[640px] lg:min-w-0">
          <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
          <div className="relative h-80 text-right text-xs text-slate-500">
            {[100, 80, 60, 40, 20, 0].map((value) => <span key={value} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - value}%` }}>{value}%</span>)}
          </div>
          <div className="relative h-80 border-b border-slate-400">
            {[0, 20, 40, 60, 80, 100].map((value) => <div key={value} className="pointer-events-none absolute left-0 right-0 border-t border-slate-200" style={{ bottom: `${value}%` }} />)}
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-2 sm:gap-4 sm:px-3">
              {subjects.map((subject) => (
                <div key={subject.subject.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <div className="flex h-full items-end gap-1">
                    <StatusChartBar metric={subject.assessments[0]} label="Pass" color="bg-blue-600" value={(item) => item.pass} />
                    <StatusChartBar metric={subject.assessments[0]} label="Fail" color="bg-red-500" value={(item) => item.fail} />
                    <StatusChartBar metric={subject.assessments[0]} label="MC / OL / AB" color="bg-amber-500" value={(item) => item.exempted} />
                    <StatusChartBar metric={subject.assessments[0]} label="Not entered" color="bg-slate-400" value={(item) => item.notEntered} />
                  </div>
                  <span className="mt-3 max-w-28 text-center text-xs font-semibold text-slate-700">{subject.subject.name}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusChartBar({ metric, label, color, value }: { metric?: AssessmentMetric; label: string; color: string; value: (metric: AssessmentMetric) => number }) {
  if (!metric) return <div className="relative flex h-72 w-4 items-end justify-center sm:w-6" aria-hidden />;
  const total = metric.pass + metric.fail + metric.exempted + metric.notEntered;
  const percentage = total === 0 ? 0 : (value(metric) / total) * 100;
  return (
    <div className="relative flex h-72 w-4 items-end justify-center sm:w-6" title={`${label}: ${formatNumber(percentage)}%`}>
      {total === 0 ? <span className="mb-1 text-[10px] font-semibold text-slate-400">-</span> : (
        <div className="relative w-full" style={{ height: `${percentage}%` }}>
          <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-white px-0.5 text-[10px] font-bold text-slate-700 shadow-sm">{formatNumber(percentage)}%</span>
          <div className={`h-full w-full rounded-t-md shadow-sm transition-[height] duration-700 ${color}`} />
        </div>
      )}
    </div>
  );
}

function AssessmentDetailCell({ metric }: { metric: AssessmentMetric }) {
  return (
    <td className="min-w-[150px] px-5 py-4 text-sm">
      <p className="font-bold tabular-nums text-slate-900">{formatNumber(metric.average)} average</p>
      <p className="mt-1 text-xs font-semibold"><span className="text-emerald-700">{metric.pass} pass</span><span className="mx-1 text-slate-300">·</span><span className="text-rose-700">{metric.fail} fail</span></p>
      <p className="mt-1 text-xs text-slate-500">{metric.exempted} exempted · {metric.notEntered} not entered</p>
    </td>
  );
}

function StudentPassFailTable({ metrics }: { metrics: StudentMetric[] }) {
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Student detail</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">Pass and fail papers for every student</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Pass</th><th className="px-5 py-3">Fail</th><th className="px-5 py-3">Exempted</th><th className="px-5 py-3">Not entered</th><th className="min-w-[220px] px-5 py-3">Performance</th></tr>
          </thead>
          <tbody>
            {metrics.map((item) => <StudentRow key={item.student.id} metric={item} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StudentRow({ metric }: { metric: StudentMetric }) {
  const total = metric.pass + metric.fail + metric.exempted + metric.notEntered;
  const width = (value: number) => `${total === 0 ? 0 : (value / total) * 100}%`;
  return (
    <tr className="border-t border-slate-100 align-middle odd:bg-white even:bg-slate-50/40">
      <td className="whitespace-nowrap px-5 py-4"><div className="flex items-center gap-3"><StudentPhoto fullName={metric.student.full_name} photoUrl={metric.student.photo_url} className="h-9 w-9 rounded-lg" textClass="text-[11px]" /><div><p className="font-semibold text-slate-900">{metric.student.full_name}</p><p className="text-xs text-slate-500">Index No {metric.student.roll_no || '-'}</p></div></div></td>
      <td className="px-5 py-4 text-sm font-bold text-emerald-700">{metric.pass}</td>
      <td className="px-5 py-4 text-sm font-bold text-rose-700">{metric.fail}</td>
      <td className="px-5 py-4 text-sm font-bold text-amber-700">{metric.exempted}</td>
      <td className="px-5 py-4 text-sm font-bold text-slate-500">{metric.notEntered}</td>
      <td className="px-5 py-4"><div className="flex h-3 min-w-[180px] overflow-hidden rounded-full bg-slate-200"><div className="bg-emerald-500" style={{ width: width(metric.pass) }} /><div className="bg-rose-400" style={{ width: width(metric.fail) }} /><div className="bg-amber-400" style={{ width: width(metric.exempted) }} /><div className="bg-slate-300" style={{ width: width(metric.notEntered) }} /></div></td>
    </tr>
  );
}

function buildSeries(assessments: Assessment[], semester: number): AssessmentSeries[] {
  const unique = new Map<string, { sourceName: string; sortOrder: number }>();
  assessments.forEach((assessment) => {
    const name = assessment.part === 'term' ? `${semester === 1 ? '1st' : '2nd'} Term test` : assessment.name;
    const current = unique.get(name);
    if (!current || assessment.sort_order < current.sortOrder) unique.set(name, { sourceName: assessment.name, sortOrder: assessment.sort_order });
  });
  const termName = `${semester === 1 ? '1st' : '2nd'} Term test`;
  if (!unique.has(termName)) unique.set(termName, { sourceName: 'Term Test', sortOrder: Number.MAX_SAFE_INTEGER });
  return [...unique.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([name, details], index) => ({ name, ...details, ...SERIES_COLORS[index % SERIES_COLORS.length] }));
}

function buildSubjectMetrics(subjects: Subject[], series: AssessmentSeries[], results: StudentResult[], sheet: SheetKind): SubjectMetric[] {
  return subjects.map((subject) => ({
    subject,
    assessments: series.map((item) => {
      const values = results.flatMap((result) => {
        const subjectResult = result.subjects.find((entry) => entry.subjectId === subject.id);
        const assessment = subjectResult?.assessments.find((entry) => entry.name === item.sourceName);
        return assessment ? [assessment] : [];
      });
      return metricForAssessments(item, values, sheet, results.length);
    }),
  }));
}

function buildStudentMetrics(students: Student[], series: AssessmentSeries[], results: StudentResult[], sheet: SheetKind): StudentMetric[] {
  const resultById = new Map(results.map((result) => [result.studentId, result]));
  return students.map((student) => {
    const result = resultById.get(student.id);
    const statuses = result?.subjects.flatMap((subject) => series.map((item) => {
      const assessment = subject.assessments.find((entry) => entry.name === item.sourceName);
      return assessment ? assessmentStatus(assessment, sheet) : 'not-entered';
    })) ?? [];
    return {
      student,
      pass: statuses.filter((status) => status === 'pass').length,
      fail: statuses.filter((status) => status === 'fail').length,
      exempted: statuses.filter((status) => status === 'exempted').length,
      notEntered: statuses.filter((status) => status === 'not-entered').length,
    };
  });
}

function metricForAssessments(series: AssessmentSeries, assessments: AssessmentResult[], sheet: SheetKind, studentCount: number): AssessmentMetric {
  const entered = assessments.filter((assessment) => assessment.percent !== null);
  const statuses = assessments.map((assessment) => assessmentStatus(assessment, sheet));
  return {
    series,
    average: averageOf(entered.map((assessment) => assessment.percent)),
    pass: statuses.filter((status) => status === 'pass').length,
    fail: statuses.filter((status) => status === 'fail').length,
    exempted: statuses.filter((status) => status === 'exempted').length,
    notEntered: assessments.length === 0 ? studentCount : statuses.filter((status) => status === 'not-entered').length,
  };
}

function assessmentStatus(assessment: AssessmentResult, sheet: SheetKind): PerformanceStatus {
  if (assessment.absence) return 'exempted';
  if (assessment.percent === null) return 'not-entered';
  return isPassingGrade(assessment.grade, sheet) ? 'pass' : 'fail';
}

function PerformanceMetric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: ReactNode; tone: 'blue' | 'emerald' | 'rose' | 'slate' }) {
  const tones = { blue: 'border-blue-500 bg-blue-50 text-blue-800', emerald: 'border-emerald-500 bg-emerald-50 text-emerald-800', rose: 'border-rose-500 bg-rose-50 text-rose-800', slate: 'border-slate-400 bg-slate-100 text-slate-700' } as const;
  return <article className={`rounded-2xl border border-slate-200 border-t-4 bg-white p-5 shadow-sm ${tones[tone].split(' ')[0]}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className={`rounded-xl p-2.5 ${tones[tone].split(' ').slice(1).join(' ')}`}>{icon}</span></div></article>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5 text-slate-600"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>;
}

function averageOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0) / present.length;
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : String(Number(value.toFixed(1)));
}
