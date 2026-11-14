import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  Layers3,
  Printer,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { ClassSemesterPicker } from '@/components/ClassSemesterPicker';
import { OutcomeBar } from '@/components/report/OutcomeBar';
import { StudentReportCard } from '@/components/report/StudentReportCard';
import { GradeSubjectAnalysis } from '@/components/report/GradeSubjectAnalysis';
import { ResultTable, type ResultRow } from '@/components/results/ResultTable';
import { EmptyState, Notice, PageHeader, SelectField, Spinner } from '@/components/ui';
import { computeGradeResults, formatPercent, type SheetKind, type StudentResult } from '@/lib/grading';
import type { Student } from '@/lib/types';
import {
  buildAggregateRows,
  buildAssessmentOutcomes,
  buildGradeDistribution,
  isPassingGrade,
  summariseClass,
  type AggregateRow,
  type AssessmentOutcome,
  type GradeDistribution,
  type OutcomeSummary,
} from '@/lib/reporting';
import { classLabel, MARKS_SHEET_YEAR } from '@/lib/school';
import { useClassSemesterData } from '@/lib/useClassSemesterData';
import { useClasses } from '@/lib/useClasses';
import { useSchoolYears } from '@/lib/useSchoolYears';
import { cardClass, gradeBadgeClass, gradeBarClass, secondaryButtonClass } from '@/lib/styles';
import { StudentPhoto } from '@/components/report/StudentPhoto';
import { printReport } from '@/lib/printReport';

type ReportView = 'analysis' | 'subject-analysis' | 'assessment' | 'semester' | 'class-pass' | 'aggregate';

const SECONDARY_AGGREGATE_CODES = new Set(['9BS', '9SC', '10BS', '10SC']);
const REPORT_TABS: { id: ReportView; label: string; icon: typeof BarChart3 }[] = [
  { id: 'analysis', label: 'Student analysis', icon: BarChart3 },
  { id: 'subject-analysis', label: 'Grade subject analysis', icon: BookOpenCheck },
  { id: 'assessment', label: 'Assessment outcomes', icon: ClipboardCheck },
  { id: 'semester', label: 'Semester final report', icon: FileText },
  { id: 'class-pass', label: 'Class pass report', icon: ShieldCheck },
  { id: 'aggregate', label: 'Two-semester aggregate', icon: Layers3 },
];

export default function ReportsPage() {
  const [view, setView] = useState<ReportView>('analysis');
  const [classCode, setClassCode] = useState('1');
  const [semester, setSemester] = useState(2);
  const [reportYear, setReportYear] = useState(MARKS_SHEET_YEAR);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const { classes } = useClasses();
  const { years, defaultYear, error: yearsError } = useSchoolYears();
  const firstSemester = useClassSemesterData(classCode, reportYear, 1, semester === 1 || view === 'aggregate');
  const secondSemester = useClassSemesterData(classCode, reportYear, 2, semester === 2 || view === 'aggregate');
  const selectedState = semester === 1 ? firstSemester : secondSemester;
  const classOption = classes.find((item) => item.value === classCode);
  const sheet = classOption?.sheetKind ?? 'primary';
  const aggregateAvailable = sheet === 'secondary' && SECONDARY_AGGREGATE_CODES.has(classCode);

  useEffect(() => {
    if (classes.length > 0 && !classOption) setClassCode(classes[0].value);
  }, [classes, classOption]);

  useEffect(() => {
    if (years.length > 0 && !years.some((item) => item.year === reportYear)) setReportYear(defaultYear);
  }, [defaultYear, reportYear, years]);

  useEffect(() => {
    if (!selectedState.data) return;
    const students = selectedState.data.students;
    if (!students.some((student) => student.id === selectedId)) setSelectedId(students[0]?.id ?? null);
  }, [selectedId, selectedState.data]);

  useEffect(() => {
    if (!aggregateAvailable && view === 'aggregate') setView('analysis');
  }, [aggregateAvailable, view]);

  useEffect(() => {
    const subjects = selectedState.data?.subjects ?? [];
    if (!subjects.some((subject) => subject.id === selectedSubjectId)) setSelectedSubjectId(subjects[0]?.id ?? '');
  }, [selectedState.data, selectedSubjectId]);

  const firstComputed = useMemo(
    () => (firstSemester.data ? computeGradeResults(firstSemester.data, classCode, sheet) : null),
    [classCode, firstSemester.data, sheet],
  );
  const secondComputed = useMemo(
    () => (secondSemester.data ? computeGradeResults(secondSemester.data, classCode, sheet) : null),
    [classCode, secondSemester.data, sheet],
  );
  const currentComputed = semester === 1 ? firstComputed : secondComputed;
  const currentResults = useMemo(() => currentComputed?.results ?? [], [currentComputed]);
  const currentStudents = useMemo(() => selectedState.data?.students ?? [], [selectedState.data]);
  const selectedStudent = currentStudents.find((student) => student.id === selectedId) ?? null;
  const selectedResult = currentComputed?.results.find((result) => result.studentId === selectedId) ?? null;
  const classSummary = useMemo(() => summariseClass(currentResults, sheet), [currentResults, sheet]);
  const assessmentOutcomes = useMemo(
    () => buildAssessmentOutcomes(currentResults, sheet),
    [currentResults, sheet],
  );
  const distribution = useMemo(
    () => buildGradeDistribution(currentResults, sheet),
    [currentResults, sheet],
  );
  const aggregateRows = useMemo<AggregateRow[]>(
    () =>
      firstComputed && secondComputed
        ? buildAggregateRows(firstSemester.data?.students ?? secondSemester.data?.students ?? [], firstComputed.results, secondComputed.results, sheet)
        : [],
    [firstComputed, firstSemester.data, secondComputed, secondSemester.data, sheet],
  );
  const aggregateSummary = useMemo(
    () => summariseAggregateRows(aggregateRows, sheet),
    [aggregateRows, sheet],
  );
  const visibleStudents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return currentStudents.filter(
      (student) =>
        !term || student.full_name.toLowerCase().includes(term) || student.roll_no.toLowerCase().includes(term),
    );
  }, [currentStudents, query]);
  const resultRows = useMemo<ResultRow[]>(
    () =>
      currentStudents.map((student) => {
        const index = currentStudents.indexOf(student);
        const result = currentResults[index];
        return {
          student,
          result,
          rank: result ? currentComputed?.ranks.get(result.studentId) ?? null : null,
        };
      }).filter((row) => row.result),
    [currentComputed?.ranks, currentResults, currentStudents],
  );
  const topStudent = [...currentResults].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))[0];
  const classAverage = averageOf(currentResults.map((result) => result.average));
  const assessmentSummary = summariseAssessmentOutcomes(assessmentOutcomes);

  return (
    <>
      <PageHeader
        title="Student reports"
        description="Explore grade analysis, assessment outcomes, semester results, pass rates and two-semester aggregates from one clear report workspace."
        action={
          view === 'analysis' && selectedStudent && selectedResult ? (
            <button type="button" onClick={() => printReport(`Faafu Atoll School - ${selectedStudent.full_name} - ${reportYear} - Semester ${semester} Report`)} className={`${secondaryButtonClass} print:hidden`}>
              <Printer className="h-4 w-4" aria-hidden />
              Print report
            </button>
          ) : null
        }
      />

      {view === 'analysis' && selectedStudent && selectedResult && createPortal(
        <div className="print-report-root">
          <div className="student-report-printable">
            <PrintClassSummary
              className={classLabel(classCode, classes)}
              semester={semester}
              schoolYear={reportYear}
              classAverage={classAverage}
              classSummary={classSummary}
              assessmentSummary={assessmentSummary}
              topStudent={topStudent}
              totalStudents={currentResults.length}
            />
            <StudentReportCard
              key={`${selectedStudent.id}-${reportYear}-${semester}`}
              student={selectedStudent}
              result={selectedResult}
              rank={selectedResult && currentComputed ? currentComputed.ranks.get(selectedResult.studentId) ?? null : null}
              classSize={currentResults.length}
              semester={semester}
              schoolYear={reportYear}
              className={classLabel(classCode, classes)}
              sheet={sheet}
            />
          </div>
        </div>,
        document.body,
      )}

      <div className="space-y-6">
        <section className={`${cardClass} overflow-hidden bg-white`}>
          <div className="bg-gradient-to-r from-blue-950 via-blue-800 to-sky-500 px-5 py-6 text-white sm:px-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Reporting workspace</p>
                <h2 className="mt-2 font-serif text-3xl font-bold">{classLabel(classCode, classes)}</h2>
                <p className="mt-1 text-sm text-blue-100">{reportYear} · {semester === 1 ? 'First semester' : 'Second semester'} · {sheet === 'secondary' ? 'Secondary grading' : 'Primary grading'}</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
                <span className="block text-xs font-semibold uppercase tracking-wide text-blue-100">Current view</span>
                {REPORT_TABS.find((tab) => tab.id === view)?.label}
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,560px)_1fr] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-end">
              <ClassSemesterPicker
                classes={classes}
                classCode={classCode}
                semester={semester}
                onClassChange={(value) => {
                  setClassCode(value);
                  setSelectedId(null);
                  setSelectedSubjectId('');
                }}
                onSemesterChange={(value) => {
                  setSemester(value);
                  setSelectedId(null);
                }}
              />
              <SelectField label="School year" value={String(reportYear)} onChange={(value) => setReportYear(Number(value))}>
                {years.length === 0 ? <option value={String(MARKS_SHEET_YEAR)}>{MARKS_SHEET_YEAR}</option> : years.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}
              </SelectField>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 lg:justify-end">
              <Users className="h-4 w-4 text-blue-700" aria-hidden />
              <span>{currentStudents.length} students</span>
              <span className="text-slate-300">·</span>
              <span>{selectedState.data?.subjects.length ?? 0} subjects</span>
              {aggregateAvailable && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Aggregate available</span>}
            </div>
          </div>
        </section>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm print:hidden" aria-label="Report views">
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const disabled = tab.id === 'aggregate' && !aggregateAvailable;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => setView(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  view === tab.id ? 'bg-blue-800 text-white shadow-sm' : disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-900'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {(yearsError || selectedState.error || firstSemester.error || secondSemester.error) && (
          <Notice tone="error">{yearsError ?? selectedState.error ?? firstSemester.error ?? secondSemester.error}</Notice>
        )}

        {selectedState.loading && !selectedState.data ? (
          <Spinner label="Loading report data..." />
        ) : !selectedState.data || currentStudents.length === 0 ? (
          <EmptyState title="No students in this class" description="Add students and assessments to start generating reports." />
        ) : selectedState.data.subjects.length === 0 ? (
          <EmptyState title="No subjects in this class" description="Add subjects and assessments before generating reports." />
        ) : (
          <>
            {view === 'analysis' && (
              <AnalysisView
                semester={semester}
                schoolYear={reportYear}
                query={query}
                setQuery={setQuery}
                visibleStudents={visibleStudents}
                selectedId={selectedId}
                onSelect={setSelectedId}
                selectedStudent={selectedStudent}
                selectedResult={selectedResult}
                rank={selectedResult && currentComputed ? currentComputed.ranks.get(selectedResult.studentId) ?? null : null}
                classSize={currentResults.length}
                className={classLabel(classCode, classes)}
                classAverage={classAverage}
                topStudent={topStudent}
                classSummary={classSummary}
                assessmentSummary={assessmentSummary}
                sheet={sheet}
              />
            )}
            {view === 'subject-analysis' && (
              <GradeSubjectAnalysis
                className={classLabel(classCode, classes)}
                semester={semester}
                schoolYear={reportYear}
                sheet={sheet}
                students={currentStudents}
                subjects={selectedState.data.subjects}
                results={currentResults}
                subjectId={selectedSubjectId}
                onSubjectChange={setSelectedSubjectId}
              />
            )}
            {view === 'assessment' && <AssessmentView outcomes={assessmentOutcomes} summary={assessmentSummary} sheet={sheet} />}
            {view === 'semester' && (
              <SemesterView
                rows={resultRows}
                subjects={selectedState.data.subjects}
                classSummary={classSummary}
                classAverage={classAverage}
                topStudent={topStudent}
                removeFinalPercent={sheet === 'primary'}
              />
            )}
            {view === 'class-pass' && <ClassPassView summary={classSummary} distribution={distribution} rows={resultRows} sheet={sheet} />}
            {view === 'aggregate' && (
              <AggregateView
                available={aggregateAvailable}
                loading={firstSemester.loading || secondSemester.loading}
                rows={aggregateRows}
                summary={aggregateSummary}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

function AnalysisView({
  semester,
  schoolYear,
  query,
  setQuery,
  visibleStudents,
  selectedId,
  onSelect,
  selectedStudent,
  selectedResult,
  rank,
  classSize,
  className,
  classAverage,
  topStudent,
  classSummary,
  assessmentSummary,
  sheet,
}: {
  semester: number;
  schoolYear: number;
  query: string;
  setQuery: (value: string) => void;
  visibleStudents: Student[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedStudent: Student | null;
  selectedResult: StudentResult | null;
  rank: number | null;
  classSize: number;
  className: string;
  classAverage: number | null;
  topStudent: StudentResult | undefined;
  classSummary: OutcomeSummary;
  assessmentSummary: OutcomeSummary;
  sheet: SheetKind;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportKpi label="Class average" value={formatPercent(classAverage)} detail="Across all subjects" icon={<BarChart3 className="h-5 w-5" />} tone="blue" />
        <ReportKpi label="Class pass rate" value={formatPercent(classSummary.passRate)} detail={`${classSummary.pass} of ${classSummary.total} students`} icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" />
        <ReportKpi label="Papers passed" value={formatPercent(assessmentSummary.passRate)} detail={`${assessmentSummary.pass} of ${assessmentSummary.total} assessments`} icon={<BookOpenCheck className="h-5 w-5" />} tone="sky" />
        <ReportKpi label="Top student" value={topStudent ? formatPercent(topStudent.average) : '-'} detail={topStudent ? 'Highest class average' : 'No results yet'} icon={<Trophy className="h-5 w-5" />} tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className={`${cardClass} p-4`}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search students"
                aria-label="Search students"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>
          <div className={`${cardClass} max-h-[620px] overflow-y-auto p-2`}>
            <div className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Students</div>
            <ul className="divide-y divide-slate-100">
              {visibleStudents.map((student) => {
                const active = student.id === selectedId;
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(student.id)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50'}`}
                    >
                      <StudentPhoto fullName={student.full_name} photoUrl={student.photo_url} className="h-9 w-9 rounded-lg" textClass="text-[11px]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{student.full_name}</span>
                        <span className="block text-xs text-slate-500">Index No {student.roll_no || '-'}</span>
                      </span>
                      <span className="text-xs font-bold text-blue-800">{active ? 'Viewing' : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section>
          {!selectedStudent || !selectedResult ? (
            <EmptyState title="Select a student" description="Choose a student from the list to open their grade analysis." />
          ) : (
            <div className="student-report-screen">
              <PrintClassSummary
                className={className}
                semester={semester}
                schoolYear={schoolYear}
                classAverage={classAverage}
                classSummary={classSummary}
                assessmentSummary={assessmentSummary}
                topStudent={topStudent}
                totalStudents={classSize}
              />
              <StudentReportCard
                key={`${selectedStudent.id}-${schoolYear}-${semester}`}
                student={selectedStudent}
                result={selectedResult}
                rank={rank}
                classSize={classSize}
                semester={semester}
                schoolYear={schoolYear}
                className={className}
                sheet={sheet}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PrintClassSummary({ className, semester, schoolYear, classAverage, classSummary, assessmentSummary, topStudent, totalStudents }: { className: string; semester: number; schoolYear: number; classAverage: number | null; classSummary: OutcomeSummary; assessmentSummary: OutcomeSummary; topStudent: StudentResult | undefined; totalStudents: number }) {
  return (
    <section className="student-print-summary">
      <div className="student-print-summary-heading"><p>Class summary</p><strong>{className} · {schoolYear} · {semester === 1 ? 'First semester' : 'Second semester'}</strong></div>
      <div className="student-print-summary-metrics">
        <div><span>Class average</span><strong>{formatPercent(classAverage)}</strong></div>
        <div><span>Class pass rate</span><strong>{formatPercent(classSummary.passRate)}</strong></div>
        <div><span>Papers passed</span><strong>{assessmentSummary.pass} / {assessmentSummary.total}</strong></div>
        <div><span>Top student</span><strong>{topStudent ? formatPercent(topStudent.average) : '-'}</strong></div>
        <div><span>Total students</span><strong>{totalStudents}</strong></div>
      </div>
    </section>
  );
}

function AssessmentView({ outcomes, summary, sheet }: { outcomes: AssessmentOutcome[]; summary: OutcomeSummary; sheet: SheetKind }) {
  return (
    <section className="space-y-6">
      <div className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 bg-slate-900 px-6 py-6 text-white sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Assessment pass and fail report</p>
            <h2 className="mt-2 text-2xl font-bold">Paper-by-paper outcomes</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {sheet === 'secondary' ? 'Pass is A* to C. Fail is D, E or U.' : 'Pass is FA or MA. Fail is A or an ungraded paper.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-300">All papers</p>
            <p className="mt-1 text-3xl font-bold">{formatPercent(summary.passRate)}</p>
            <p className="text-xs text-emerald-300">pass rate</p>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <MiniOutcome label="Passed" value={summary.pass} tone="emerald" />
          <MiniOutcome label="Failed" value={summary.fail} tone="rose" />
          <MiniOutcome label="Total papers entered" value={summary.total} tone="slate" />
        </div>
      </div>

      {outcomes.length === 0 ? (
        <EmptyState title="No assessment results yet" description="Assessment outcomes will appear after marks have been entered." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {outcomes.map((outcome) => (
            <article key={outcome.id} className={`${cardClass} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{outcome.subjectName}</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{outcome.name}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${outcome.passRate >= 50 ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' : 'bg-rose-50 text-rose-800 ring-rose-600/20'}`}>
                  {formatPercent(outcome.passRate)} pass
                </span>
              </div>
              <div className="mt-5"><OutcomeBar summary={outcome} /></div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{outcome.pass} passed</span>
                <span>{outcome.fail} failed</span>
                <span>{outcome.total} students</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SemesterView({ rows, subjects, classSummary, classAverage, topStudent, removeFinalPercent }: { rows: ResultRow[]; subjects: { id: string; name: string; class_name: string; sort_order: number }[]; classSummary: OutcomeSummary; classAverage: number | null; topStudent: StudentResult | undefined; removeFinalPercent: boolean }) {
  return (
    <section className="space-y-6">
      <ReportIntro eyebrow="Each semester · all students" title="Semester final report" description="The complete class result for the selected semester, including every subject, final grade and rank." />
      <div className="grid gap-4 sm:grid-cols-3">
        <ReportKpi label="Class average" value={formatPercent(classAverage)} detail="Selected semester" icon={<BarChart3 className="h-5 w-5" />} tone="blue" />
        <ReportKpi label="Class pass rate" value={formatPercent(classSummary.passRate)} detail={`${classSummary.pass} passing students`} icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" />
        <ReportKpi label="Top student" value={topStudent ? formatPercent(topStudent.average) : '-'} detail="Highest average" icon={<Trophy className="h-5 w-5" />} tone="sky" />
      </div>
      {rows.length === 0 ? <EmptyState title="No final results yet" description="The final report will appear after students and subjects have results." /> : <ResultTable subjects={subjects} rows={rows} removeFinalPercent={removeFinalPercent} />}
    </section>
  );
}

function ClassPassView({ summary, distribution, rows, sheet }: { summary: OutcomeSummary; distribution: GradeDistribution[]; rows: ResultRow[]; sheet: SheetKind }) {
  return (
    <section className="space-y-6">
      <ReportIntro eyebrow="Whole class · selected semester" title="Class pass report" description={sheet === 'secondary' ? 'Students with A* to C are counted as passing. D, E and U are counted as failing.' : 'Students with FA or MA are counted as passing. A is counted as failing.'} />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`${cardClass} p-6`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Class outcome</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">{formatPercent(summary.passRate)}</p>
              <p className="mt-1 text-sm text-slate-500">pass rate · {summary.pass} of {summary.total} students</p>
            </div>
            <ShieldCheck className="h-10 w-10 text-emerald-500" aria-hidden />
          </div>
          <div className="mt-7"><OutcomeBar summary={summary} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniOutcome label="Passed" value={summary.pass} tone="emerald" />
            <MiniOutcome label="Failed" value={summary.fail} tone="rose" />
          </div>
        </div>
        <div className={`${cardClass} p-6`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><BarChart3 className="h-5 w-5" aria-hidden /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grade distribution</p><h3 className="mt-1 text-lg font-bold text-slate-900">Final grades</h3></div>
          </div>
          <div className="mt-6 space-y-4">
            {distribution.map((item) => (
              <div key={item.grade}>
                <div className="mb-1.5 flex items-center justify-between text-sm"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${gradeBadgeClass(item.grade)}`}>{item.grade}</span><span className="font-semibold text-slate-700">{item.count} · {formatPercent(item.percentage)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${gradeBarClass(item.grade)} transition-[width] duration-700`} style={{ width: `${item.percentage}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-semibold text-slate-900">Student pass list</h3><p className="mt-1 text-sm text-slate-500">Every student’s final grade and pass status for this semester.</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Average</th><th className="px-5 py-3">Final grade</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{rows.map((row) => { const passed = isPassingGrade(row.result.finalGrade, sheet); return <tr key={row.student.id} className="border-t border-slate-100"><td className="px-5 py-3"><p className="font-medium text-slate-900">{row.student.full_name}</p><p className="text-xs text-slate-500">Index No {row.student.roll_no || '-'}</p></td><td className="px-5 py-3 text-sm font-semibold tabular-nums text-slate-800">{formatPercent(row.result.average)}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${gradeBadgeClass(row.result.finalGrade)}`}>{row.result.finalGrade}</span></td><td className="px-5 py-3"><span className={`text-sm font-semibold ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>{passed ? 'Pass' : 'Fail'}</span></td></tr>; })}</tbody></table></div>
      </div>
    </section>
  );
}

function AggregateView({ available, loading, rows, summary }: { available: boolean; loading: boolean; rows: AggregateRow[]; summary: OutcomeSummary }) {
  if (!available) return <Notice tone="info">Two-semester aggregate reports are available for Grades 9 BS, 9 SC, 10 BS and 10 SC.</Notice>;
  if (loading && rows.length === 0) return <Spinner label="Loading both semesters..." />;
  return (
    <section className="space-y-6">
      <ReportIntro eyebrow="Secondary grades · semesters 1 + 2" title="Two-semester aggregate" description="Each student’s aggregate is calculated as (Semester 1 average + Semester 2 average) ÷ 2, then the final grade is assigned from that aggregate." />
      <div className="grid gap-4 sm:grid-cols-3"><ReportKpi label="Aggregate pass rate" value={formatPercent(summary.passRate)} detail={`${summary.pass} passing students`} icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" /><ReportKpi label="Students included" value={String(summary.total)} detail="Both semesters available" icon={<Users className="h-5 w-5" />} tone="blue" /><ReportKpi label="Highest aggregate" value={formatPercent(Math.max(...rows.map((row) => row.aggregate ?? 0), 0))} detail="Best combined average" icon={<Trophy className="h-5 w-5" />} tone="sky" /></div>
      <div className={`${cardClass} overflow-x-auto`}><table className="min-w-full text-left"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Index No</th><th className="min-w-[220px] px-4 py-3">Student</th><th className="px-4 py-3">Semester 1</th><th className="px-4 py-3">Semester 2</th><th className="px-4 py-3">Aggregate</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Rank</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.student.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50"><td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td><td className="px-4 py-3 font-medium text-slate-900">{row.student.full_name}</td><td className="px-4 py-3 text-sm tabular-nums text-slate-700">{formatPercent(row.semesterOne)}</td><td className="px-4 py-3 text-sm tabular-nums text-slate-700">{formatPercent(row.semesterTwo)}</td><td className="px-4 py-3 font-bold tabular-nums text-blue-800">{formatPercent(row.aggregate)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${gradeBadgeClass(row.finalGrade)}`}>{row.finalGrade}</span></td><td className="px-4 py-3 font-bold text-blue-800">{row.rank ?? '-'}</td></tr>)}</tbody></table></div>
    </section>
  );
}

function ReportIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p></div>;
}

function ReportKpi({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: ReactNode; tone: 'blue' | 'emerald' | 'sky' }) {
  const tones = { blue: 'border-blue-500 bg-blue-50 text-blue-800', emerald: 'border-emerald-500 bg-emerald-50 text-emerald-800', sky: 'border-sky-500 bg-sky-50 text-sky-800' } as const;
  return <article className={`rounded-2xl border border-slate-200 border-t-4 bg-white p-5 shadow-sm ${tones[tone].split(' ')[0]}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className={`rounded-xl p-2.5 ${tones[tone].split(' ').slice(1).join(' ')}`}>{icon}</span></div></article>;
}

function MiniOutcome({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' | 'slate' }) {
  const style = tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : tone === 'rose' ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-800';
  return <div className={`rounded-2xl p-4 ${style}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}

function averageOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0) / present.length;
}

function summariseAssessmentOutcomes(outcomes: AssessmentOutcome[]): OutcomeSummary {
  return outcomes.reduce(
    (summary, outcome) => ({
      pass: summary.pass + outcome.pass,
      fail: summary.fail + outcome.fail,
      total: summary.total + outcome.total,
      passRate: 0,
      failRate: 0,
    }),
    { pass: 0, fail: 0, total: 0, passRate: 0, failRate: 0 },
  ).total === 0
    ? { pass: 0, fail: 0, total: 0, passRate: 0, failRate: 0 }
    : calculateSummary(outcomes.reduce((sum, outcome) => sum + outcome.pass, 0), outcomes.reduce((sum, outcome) => sum + outcome.fail, 0));
}

function summariseAggregateRows(rows: AggregateRow[], sheet: SheetKind): OutcomeSummary {
  const complete = rows.filter((row) => row.aggregate !== null);
  return summariseGrades(complete.map((row) => row.finalGrade), sheet);
}

function summariseGrades(grades: string[], sheet: SheetKind): OutcomeSummary {
  const pass = grades.filter((grade) => isPassingGrade(grade, sheet)).length;
  return calculateSummary(pass, grades.length - pass);
}

function calculateSummary(pass: number, fail: number): OutcomeSummary {
  const total = pass + fail;
  return { pass, fail, total, passRate: total === 0 ? 0 : (pass / total) * 100, failRate: total === 0 ? 0 : (fail / total) * 100 };
}
