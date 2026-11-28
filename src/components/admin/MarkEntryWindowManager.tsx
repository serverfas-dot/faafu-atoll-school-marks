import { useEffect, useState } from 'react';
import { CalendarClock, Clock3, Save, Trash2 } from 'lucide-react';
import { EmptyState, Notice, SelectField, Spinner } from '@/components/ui';
import { SEMESTERS, MARKS_SHEET_YEAR, semesterLabel } from '@/lib/school';
import { useSchoolYears } from '@/lib/useSchoolYears';
import { useClasses } from '@/lib/useClasses';
import {
  formatWindowDate,
  isMarkEntryWindowOpen,
  listAssessmentMarkEntryWindows,
  removeAssessmentMarkEntryWindow,
  saveAssessmentMarkEntryWindow,
  toLocalDateTimeInput,
  type AssessmentMarkEntryWindow,
} from '@/lib/markEntryWindows';
import { supabase } from '@/lib/supabase';
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass } from '@/lib/styles';
import type { Assessment, Subject } from '@/lib/types';

type AssessmentTarget = Pick<Assessment, 'id' | 'semester' | 'name' | 'max_mark' | 'part' | 'sort_order'> & {
  subjectName: string;
};

type Draft = { opensAt: string; closesAt: string };

type Drafts = Record<string, Draft>;
type Windows = Record<string, AssessmentMarkEntryWindow | undefined>;

function applyWindows(targets: AssessmentTarget[], rows: AssessmentMarkEntryWindow[]): { drafts: Drafts; windows: Windows } {
  const windows: Windows = Object.fromEntries(rows.map((row) => [row.assessment_id, row]));
  const drafts: Drafts = Object.fromEntries(
    targets.map((target) => {
      const window = windows[target.id];
      return [target.id, { opensAt: window ? toLocalDateTimeInput(window.opens_at) : '', closesAt: window ? toLocalDateTimeInput(window.closes_at) : '' }];
    }),
  );
  return { drafts, windows };
}

export function MarkEntryWindowManager() {
  const { classes } = useClasses();
  const { years, defaultYear } = useSchoolYears();
  const [classCode, setClassCode] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
  const [targets, setTargets] = useState<AssessmentTarget[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [windows, setWindows] = useState<Windows>({});
  const [loading, setLoading] = useState(true);
  const [busyAssessmentId, setBusyAssessmentId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (classes.length > 0 && !classes.some((item) => item.value === classCode)) setClassCode(classes[0].value);
  }, [classCode, classes]);

  useEffect(() => {
    if (year === null) setYear(defaultYear);
    else if (years.length > 0 && !years.some((item) => item.year === year)) setYear(defaultYear);
  }, [defaultYear, year, years]);

  useEffect(() => {
    if (!classCode || year === null) return;
    const selectedYear = year;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data: subjectRows, error: subjectError } = await supabase
          .from('subjects')
          .select('id, name, class_name, sort_order')
          .eq('class_name', classCode)
          .order('sort_order');
        if (subjectError) throw new Error(subjectError.message);
        const subjects = (subjectRows ?? []) as Subject[];
        const subjectIds = subjects.map((subject) => subject.id);
        const [assessmentResult, windowRows] = await Promise.all([
          subjectIds.length === 0
            ? Promise.resolve({ data: [], error: null })
            : supabase
                .from('assessments')
                .select('id, subject_id, semester, name, max_mark, part, sort_order')
                .eq('school_year', selectedYear)
                .eq('is_active', true)
                .in('subject_id', subjectIds)
                .order('semester')
                .order('sort_order'),
          listAssessmentMarkEntryWindows(selectedYear),
        ]);
        if (assessmentResult.error) throw new Error(assessmentResult.error.message);
        const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
        const nextTargets = ((assessmentResult.data ?? []) as Pick<Assessment, 'id' | 'subject_id' | 'semester' | 'name' | 'max_mark' | 'part' | 'sort_order'>[]).map((assessment) => ({
          id: assessment.id,
          semester: Number(assessment.semester) as 1 | 2,
          name: assessment.name,
          max_mark: assessment.max_mark,
          part: assessment.part,
          sort_order: assessment.sort_order,
          subjectName: subjectNames.get(assessment.subject_id) ?? 'Subject',
        }));
        if (cancelled) return;
        const next = applyWindows(nextTargets, windowRows);
        setTargets(nextTargets);
        setDrafts(next.drafts);
        setWindows(next.windows);
        setMessage(null);
      } catch (err) {
        if (!cancelled) setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not load assessment windows.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [classCode, version, year]);

  const handleSave = async (target: AssessmentTarget) => {
    if (year === null) return;
    const draft = drafts[target.id] ?? { opensAt: '', closesAt: '' };
    setBusyAssessmentId(target.id);
    setMessage(null);
    try {
      await saveAssessmentMarkEntryWindow(target.id, year, target.semester as 1 | 2, draft.opensAt, draft.closesAt);
      setVersion((value) => value + 1);
      setMessage({ tone: 'success', text: `${target.subjectName} · ${target.name} window saved.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save the assessment window.' });
    } finally {
      setBusyAssessmentId(null);
    }
  };

  const handleRemove = async (target: AssessmentTarget) => {
    setBusyAssessmentId(target.id);
    setMessage(null);
    try {
      await removeAssessmentMarkEntryWindow(target.id);
      setVersion((value) => value + 1);
      setMessage({ tone: 'success', text: `${target.subjectName} · ${target.name} is now closed for teacher entry.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not close the assessment window.' });
    } finally {
      setBusyAssessmentId(null);
    }
  };

  if (loading) return <Spinner label="Loading assessment windows..." />;

  return (
    <div className="space-y-6">
      <div className={`${cardClass} space-y-4 p-5`}>
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-800"><CalendarClock className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Teacher assessment entry windows</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Open each assessment separately. Teachers can view every mark, but they can save only the assessment whose window is currently open and only for subjects assigned to them.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="School year" value={year === null ? '' : String(year)} onChange={(value) => setYear(Number(value))}>
            {years.length === 0 ? <option value={String(MARKS_SHEET_YEAR)}>{MARKS_SHEET_YEAR}</option> : years.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}
          </SelectField>
          <SelectField label="Grade" value={classCode} onChange={setClassCode}>
            {classes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
        </div>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {targets.length === 0 ? (
        <EmptyState title="No assessments for this grade" description="Add active assessments for this school year before opening teacher mark entry." />
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {SEMESTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSelectedSemester(item.value)}
                aria-pressed={selectedSemester === item.value}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${selectedSemester === item.value ? 'bg-blue-700 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
              >
                {semesterLabel(item.value)}
              </button>
            ))}
          </div>
          {(() => {
            const semesterTargets = targets.filter((target) => Number(target.semester) === selectedSemester);
            if (semesterTargets.length === 0) {
              return <EmptyState title={`No assessments for ${semesterLabel(selectedSemester)}`} description="This semester has no assessments set up for this grade yet." />;
            }
            const semesterInfo = SEMESTERS.find((item) => item.value === selectedSemester);
            return (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{semesterLabel(selectedSemester)}</h2>
                  <p className="mt-1 text-sm text-slate-500">{semesterInfo?.dates} · Open each assessment only when teachers should enter it.</p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {semesterTargets.map((target) => {
                    const window = windows[target.id] ?? null;
                    const draft = drafts[target.id] ?? { opensAt: '', closesAt: '' };
                    const open = isMarkEntryWindowOpen(window);
                    const busy = busyAssessmentId === target.id;
                    return (
                      <article key={target.id} className={`${cardClass} space-y-4 p-5`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{target.subjectName}</p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">{target.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{target.part === 'unit' ? 'Unit test' : 'Term test'} · Out of {target.max_mark}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${open ? 'bg-emerald-100 text-emerald-800' : window ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                            {open ? 'Open now' : window ? 'Scheduled' : 'Closed'}
                          </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4 text-slate-400" aria-hidden />Opens</span>
                            <input type="datetime-local" value={draft.opensAt} onChange={(event) => setDrafts((current) => ({ ...current, [target.id]: { ...current[target.id], opensAt: event.target.value } }))} className={inputClass} />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4 text-slate-400" aria-hidden />Closes</span>
                            <input type="datetime-local" value={draft.closesAt} onChange={(event) => setDrafts((current) => ({ ...current, [target.id]: { ...current[target.id], closesAt: event.target.value } }))} className={inputClass} />
                          </label>
                        </div>
                        {window ? <p className="text-xs text-slate-500">Current schedule: {formatWindowDate(window.opens_at)} to {formatWindowDate(window.closes_at)}</p> : <p className="text-xs text-slate-500">No teacher entry allowed until this assessment is scheduled.</p>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void handleSave(target)} disabled={busy} className={primaryButtonClass}>
                            <Save className="h-4 w-4" aria-hidden />
                            {busy ? 'Saving...' : 'Save window'}
                          </button>
                          {window && (
                            <button type="button" onClick={() => void handleRemove(target)} disabled={busy} className={dangerButtonClass}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                              Close window
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        </div>
      )}
    </div>
  );
}
