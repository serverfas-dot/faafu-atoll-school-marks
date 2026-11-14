import { useEffect, useState } from 'react';
import { CalendarClock, Clock3, Save, Trash2 } from 'lucide-react';
import { Notice, SelectField, Spinner } from '@/components/ui';
import { SEMESTERS, MARKS_SHEET_YEAR } from '@/lib/school';
import { useSchoolYears } from '@/lib/useSchoolYears';
import {
  formatWindowDate,
  isMarkEntryWindowOpen,
  listMarkEntryWindows,
  removeMarkEntryWindow,
  saveMarkEntryWindow,
  toLocalDateTimeInput,
  type MarkEntryWindow,
  type SemesterValue,
} from '@/lib/markEntryWindows';
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';

type Draft = { opensAt: string; closesAt: string };
type Drafts = Record<SemesterValue, Draft>;
type Windows = Record<SemesterValue, MarkEntryWindow | null>;

const EMPTY_DRAFTS: Drafts = {
  1: { opensAt: '', closesAt: '' },
  2: { opensAt: '', closesAt: '' },
};

const EMPTY_WINDOWS: Windows = { 1: null, 2: null };
const SEMESTER_VALUES = [1, 2] as const satisfies readonly SemesterValue[];

function applyRows(rows: MarkEntryWindow[]): { drafts: Drafts; windows: Windows } {
  const drafts: Drafts = { ...EMPTY_DRAFTS };
  const windows: Windows = { ...EMPTY_WINDOWS };
  rows.forEach((row) => {
    if (row.semester !== 1 && row.semester !== 2) return;
    windows[row.semester] = row;
    drafts[row.semester] = {
      opensAt: toLocalDateTimeInput(row.opens_at),
      closesAt: toLocalDateTimeInput(row.closes_at),
    };
  });
  return { drafts, windows };
}

export function MarkEntryWindowManager() {
  const { years, defaultYear } = useSchoolYears();
  const [year, setYear] = useState(MARKS_SHEET_YEAR);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [windows, setWindows] = useState<Windows>(EMPTY_WINDOWS);
  const [loading, setLoading] = useState(true);
  const [busySemester, setBusySemester] = useState<SemesterValue | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (years.length > 0 && !years.some((item) => item.year === year)) setYear(defaultYear);
  }, [defaultYear, year, years]);

  useEffect(() => {
    let cancelled = false;
    listMarkEntryWindows(year)
      .then((rows) => {
        if (cancelled) return;
        const next = applyRows(rows);
        setDrafts(next.drafts);
        setWindows(next.windows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not load mark entry windows.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const handleSave = async (semester: SemesterValue) => {
    const draft = drafts[semester];
    setBusySemester(semester);
    setMessage(null);
    try {
      await saveMarkEntryWindow(semester, draft.opensAt, draft.closesAt, year);
      const next = applyRows(await listMarkEntryWindows(year));
      setDrafts(next.drafts);
      setWindows(next.windows);
      setMessage({ tone: 'success', text: `${semester === 1 ? 'Semester 1' : 'Semester 2'} mark entry window saved.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save the mark entry window.' });
    } finally {
      setBusySemester(null);
    }
  };

  const handleRemove = async (semester: SemesterValue) => {
    setBusySemester(semester);
    setMessage(null);
    try {
      await removeMarkEntryWindow(semester, year);
      setWindows((current) => ({ ...current, [semester]: null }));
      setDrafts((current) => ({ ...current, [semester]: { ...EMPTY_DRAFTS[semester] } }));
      setMessage({ tone: 'success', text: `${semester === 1 ? 'Semester 1' : 'Semester 2'} mark entry is now closed.` });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not close the mark entry window.' });
    } finally {
      setBusySemester(null);
    }
  };

  if (loading) return <Spinner label="Loading mark entry windows..." />;

  return (
    <div className="space-y-6">
      <div className={`${cardClass} space-y-3 p-5`}>
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-800"><CalendarClock className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Teacher mark entry windows</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Set when all teachers may enter marks for each semester. Outside the dates below, teachers can view marks but cannot save, change, or remove them.
            </p>
          </div>
        </div>
        <SelectField label="School year" value={String(year)} onChange={(value) => setYear(Number(value))}>
          {years.length === 0 ? <option value={String(MARKS_SHEET_YEAR)}>{MARKS_SHEET_YEAR}</option> : years.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}
        </SelectField>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="grid gap-5 lg:grid-cols-2">
        {SEMESTER_VALUES.map((semester) => {
          const semesterInfo = SEMESTERS.find((item) => item.value === semester);
          const window = windows[semester];
          const open = isMarkEntryWindowOpen(window);
          const busy = busySemester === semester;
          return (
            <section key={semester} className={`${cardClass} space-y-5 p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{semesterInfo?.label ?? `Semester ${semester}`}</h2>
                  <p className="mt-1 text-sm text-slate-500">{semesterInfo?.dates}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {open ? 'Open now' : window ? 'Scheduled' : 'Closed'}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4 text-slate-400" aria-hidden />Opens</span>
                  <input
                    type="datetime-local"
                    value={drafts[semester].opensAt}
                    onChange={(event) => setDrafts((current) => ({ ...current, [semester]: { ...current[semester], opensAt: event.target.value } }))}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4 text-slate-400" aria-hidden />Closes</span>
                  <input
                    type="datetime-local"
                    value={drafts[semester].closesAt}
                    onChange={(event) => setDrafts((current) => ({ ...current, [semester]: { ...current[semester], closesAt: event.target.value } }))}
                    className={inputClass}
                  />
                </label>
              </div>

              {window && <p className="text-xs text-slate-500">Current schedule: {formatWindowDate(window.opens_at)} to {formatWindowDate(window.closes_at)}</p>}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleSave(semester)} disabled={busy} className={primaryButtonClass}>
                  <Save className="h-4 w-4" aria-hidden />
                  {busy ? 'Saving...' : 'Save window'}
                </button>
                {window && (
                  <button type="button" onClick={() => void handleRemove(semester)} disabled={busy} className={dangerButtonClass}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Close window
                  </button>
                )}
                {!window && <span className={`${secondaryButtonClass} cursor-default`}>No teacher entry allowed</span>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
