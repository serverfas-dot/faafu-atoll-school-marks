import { Fragment, useMemo, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Notice } from '@/components/ui';
import { countMarks } from '@/lib/adminCounts';
import { supabase } from '@/lib/supabase';
import { computeStudentResult, formatPercent, markKey, type SheetKind } from '@/lib/grading';
import type { Assessment, Student, Subject } from '@/lib/types';
import { cardClass, dangerButtonClass, gradeBadgeClass, primaryButtonClass } from '@/lib/styles';

type Props = {
  students: Student[];
  subject: Subject;
  assessments: Assessment[];
  savedMarks: Map<string, number>;
  sheet: SheetKind;
  allowClearAllMarks?: boolean;
  canEditMarks?: boolean;
  onSaved: () => void;
};

type Change = { studentId: string; assessmentId: string; value: number | null };

const cellInputBase =
  'w-20 rounded-md border bg-white px-2 py-1.5 text-center text-sm tabular-nums shadow-sm transition focus:outline-none focus:ring-2';

const headerCellClass = 'px-3 pt-3 pb-2 text-center text-slate-800';
const valueCellClass = 'px-3 py-2 text-center text-sm tabular-nums text-slate-700';
const sectionBorder = 'border-l border-slate-200';

function parseMark(raw: string, max: number): { value: number | null; valid: boolean } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, valid: true };
  const value = Number(trimmed);
  const valid = Number.isFinite(value) && value >= 0 && value <= max;
  return { value: valid ? value : null, valid };
}

export function MarksGrid({ students, subject, assessments, savedMarks, sheet, allowClearAllMarks = false, canEditMarks = true, onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [pendingClearCount, setPendingClearCount] = useState<number | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const maxByAssessment = useMemo(() => new Map(assessments.map((item) => [item.id, item.max_mark])), [assessments]);

  const invalidKeys = useMemo(
    () =>
      new Set(
        Object.entries(draft)
          .filter(([key, raw]) => !parseMark(raw, maxByAssessment.get(key.split('|')[1]) ?? 0).valid)
          .map(([key]) => key),
      ),
    [draft, maxByAssessment],
  );

  const displayMarks = useMemo(() => {
    const merged = new Map(savedMarks);
    Object.entries(draft).forEach(([key, raw]) => {
      const { value, valid } = parseMark(raw, maxByAssessment.get(key.split('|')[1]) ?? 0);
      if (!valid) return;
      if (value === null) merged.delete(key);
      else merged.set(key, value);
    });
    return merged;
  }, [draft, savedMarks, maxByAssessment]);

  const results = useMemo(
    () => students.map((student) => computeStudentResult(student.id, [subject], assessments, displayMarks, sheet)),
    [students, subject, assessments, displayMarks, sheet],
  );

  const changes = useMemo<Change[]>(
    () =>
      Object.entries(draft).flatMap(([key, raw]) => {
        const [studentId, assessmentId] = key.split('|');
        const { value } = parseMark(raw, maxByAssessment.get(assessmentId) ?? 0);
        const saved = savedMarks.get(key);
        if ((value ?? undefined) === saved) return [];
        return [{ studentId, assessmentId, value }];
      }),
    [draft, savedMarks, maxByAssessment],
  );

  const handleSave = async () => {
    if (!canEditMarks || changes.length === 0 || invalidKeys.size > 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const upserts = changes
        .filter((change) => change.value !== null)
        .map((change) => ({
          student_id: change.studentId,
          assessment_id: change.assessmentId,
          mark: change.value,
          updated_at: new Date().toISOString(),
        }));
      if (upserts.length > 0) {
        const { error } = await supabase
          .from('marks')
          .upsert(upserts, { onConflict: 'student_id,assessment_id' });
        if (error) throw new Error(error.message);
      }
      for (const change of changes.filter((item) => item.value === null)) {
        const { error } = await supabase
          .from('marks')
          .delete()
          .eq('student_id', change.studentId)
          .eq('assessment_id', change.assessmentId);
        if (error) throw new Error(error.message);
      }
      setDraft({});
      setMessage({ tone: 'success', text: `Saved ${changes.length} change${changes.length === 1 ? '' : 's'}.` });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save the marks.' });
    } finally {
      setSaving(false);
    }
  };

  const requestClearAllMarks = async () => {
    setClearError(null);
    try {
      setPendingClearCount(await countMarks({ subjectId: subject.id }));
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not check the saved marks.' });
    }
  };

  const confirmClearAllMarks = async () => {
    if (pendingClearCount === null) return;
    setClearBusy(true);
    setClearError(null);
    try {
      const { data: assessmentRows, error: assessmentError } = await supabase
        .from('assessments')
        .select('id')
        .eq('subject_id', subject.id);
      if (assessmentError) throw new Error(assessmentError.message);
      const assessmentIds = (assessmentRows ?? []).map((row) => row.id as string);
      if (assessmentIds.length > 0) {
        const { error: deleteError } = await supabase.from('marks').delete().in('assessment_id', assessmentIds);
        if (deleteError) throw new Error(deleteError.message);
      }
      const clearedCount = pendingClearCount;
      setPendingClearCount(null);
      setDraft({});
      setMessage({ tone: 'success', text: clearedCount === 0 ? 'There were no saved marks to remove.' : `Removed ${clearedCount} saved mark${clearedCount === 1 ? '' : 's'}.` });
      onSaved();
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Could not remove the saved marks.');
    } finally {
      setClearBusy(false);
    }
  };

  const cellValue = (studentId: string, assessmentId: string) => {
    const key = markKey(studentId, assessmentId);
    if (key in draft) return draft[key];
    const saved = savedMarks.get(key);
    return saved === undefined ? '' : String(saved);
  };

  const markInput = (student: Student, item: Assessment) => {
    const key = markKey(student.id, item.id);
    return (
      <MarkInput
        value={cellValue(student.id, item.id)}
        invalid={invalidKeys.has(key)}
        max={item.max_mark}
        disabled={!canEditMarks}
        ariaLabel={`${student.full_name} ${item.name} mark out of ${item.max_mark}`}
        onChange={(next) => setDraft((prev) => ({ ...prev, [key]: next }))}
      />
    );
  };

  const canSave = canEditMarks && changes.length > 0 && invalidKeys.size === 0 && !saving;

  const unitItems = assessments.filter((item) => item.part === 'unit');
  const termItems = assessments.filter((item) => item.part === 'term');
  const unitMax = unitItems.reduce((sum, item) => sum + item.max_mark, 0);
  const termMax = termItems.reduce((sum, item) => sum + item.max_mark, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{subject.name}</h2>
          <p className="text-sm text-slate-500">
            {students.length} students. Enter each mark within the number shown above its column.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {invalidKeys.size > 0
              ? `${invalidKeys.size} mark${invalidKeys.size === 1 ? '' : 's'} above the maximum`
              : changes.length > 0
                ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}`
                : 'All changes saved'}
          </span>
          <button type="button" onClick={() => void handleSave()} disabled={!canSave} className={primaryButtonClass}>
            <Save className="h-4 w-4" aria-hidden />
            {!canEditMarks ? 'Entry closed' : saving ? 'Saving...' : 'Save marks'}
          </button>
          {allowClearAllMarks && (
            <button type="button" onClick={() => void requestClearAllMarks()} disabled={saving || clearBusy} className={dangerButtonClass}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear all marks
            </button>
          )}
        </div>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {pendingClearCount !== null && (
        <ConfirmDialog
          title={`Clear all ${subject.name} marks?`}
          confirmLabel="Clear all marks"
          busy={clearBusy}
          error={clearError}
          onConfirm={() => void confirmClearAllMarks()}
          onCancel={() => setPendingClearCount(null)}
        >
          <p>
            This will remove {pendingClearCount} saved mark{pendingClearCount === 1 ? '' : 's'} for <span className="font-semibold text-slate-900">{subject.name}</span> across every student and assessment.
          </p>
          <p className="mt-2">The subject and its assessment setup will stay in place.</p>
        </ConfirmDialog>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="min-w-full border-collapse text-left">
          {sheet === 'primary' ? (
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr className="border-b border-slate-200">
                <th rowSpan={2} className="sticky left-0 z-10 w-16 bg-slate-50 px-3 py-3">Index No</th>
                <th rowSpan={2} className="sticky left-16 z-10 min-w-[200px] bg-slate-50 px-3 py-3">Name</th>
                {assessments.map((item) => (
                  <th key={item.id} colSpan={3} className={`${sectionBorder} ${headerCellClass}`}>
                    <span className="block normal-case tracking-normal">{item.name}</span>
                    <span className="block text-[11px] font-medium normal-case text-slate-500">Out of {item.max_mark}</span>
                  </th>
                ))}
                <th colSpan={3} className={`${sectionBorder} ${headerCellClass}`}>
                  <span className="block normal-case tracking-normal">Subject total</span>
                  <span className="block text-[11px] font-medium normal-case text-slate-500">Final</span>
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                {assessments.map((item) => (
                  <Fragment key={item.id}>
                    <th className={`${sectionBorder} px-3 py-2 text-center`}>Mark</th>
                    <th className="px-3 py-2 text-center">%</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </Fragment>
                ))}
                <th className={`${sectionBorder} px-3 py-2 text-center`}>Marks</th>
                <th className="px-3 py-2 text-center">%</th>
                <th className="px-3 py-2 text-center">Grade</th>
              </tr>
            </thead>
          ) : (
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="sticky left-0 z-10 w-16 bg-slate-50 px-3 py-3">Index No</th>
                <th className="sticky left-16 z-10 min-w-[200px] bg-slate-50 px-3 py-3">Name</th>
                {unitItems.map((item) => (
                  <th key={item.id} className={`${sectionBorder} ${headerCellClass}`}>
                    <span className="block normal-case tracking-normal">{item.name}</span>
                    <span className="block text-[11px] font-medium normal-case text-slate-500">Out of {item.max_mark}</span>
                  </th>
                ))}
                <th className={`${sectionBorder} ${headerCellClass}`}>
                  <span className="block normal-case tracking-normal">Total</span>
                  <span className="block text-[11px] font-medium normal-case text-slate-500">Out of {unitMax}</span>
                </th>
                <th className={headerCellClass}>
                  <span className="block normal-case tracking-normal">30% of Unit Test</span>
                  <span className="block text-[11px] font-medium normal-case text-slate-500">Out of 30</span>
                </th>
                {termItems.map((item) => (
                  <th key={item.id} className={`${sectionBorder} ${headerCellClass}`}>
                    <span className="block normal-case tracking-normal">2nd Term Marks</span>
                    <span className="block text-[11px] font-medium normal-case text-slate-500">Out of {item.max_mark}</span>
                  </th>
                ))}
                <th className={headerCellClass}>
                  <span className="block normal-case tracking-normal">70% Term Test</span>
                  <span className="block text-[11px] font-medium normal-case text-slate-500">Out of {termMax}</span>
                </th>
                <th className={`${sectionBorder} ${headerCellClass}`}>
                  <span className="block normal-case tracking-normal">Total (100%)</span>
                  <span className="block text-[11px] font-medium normal-case text-slate-500">70% + 30%</span>
                </th>
                <th className={headerCellClass}>Grade</th>
              </tr>
            </thead>
          )}
          <tbody>
            {students.map((student, index) => {
              const subjectResult = results[index].subjects[0];
              const assessmentResult = (assessmentId: string) =>
                subjectResult?.assessments.find((row) => row.assessmentId === assessmentId);

              if (sheet === 'secondary') {
                return (
                  <tr key={student.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-sm text-slate-600">{index + 1}</td>
                    <td className="sticky left-16 z-10 bg-inherit px-3 py-2 text-sm font-medium text-slate-900">{student.full_name}</td>
                    {unitItems.map((item) => (
                      <Fragment key={item.id}>{markInput(student, item)}</Fragment>
                    ))}
                    <td className={`${sectionBorder} ${valueCellClass}`}>
                      {subjectResult?.unit.obtained ?? 0} / {subjectResult?.unit.max ?? 0}
                    </td>
                    <td className={valueCellClass}>{formatSheetValue(subjectResult ? subjectResult.unit.points : null)}</td>
                    {termItems.map((item) => (
                      <Fragment key={item.id}>{markInput(student, item)}</Fragment>
                    ))}
                    <td className={valueCellClass}>{formatSheetValue(subjectResult ? subjectResult.term.points : null)}</td>
                    <td className={`${sectionBorder} px-3 py-2 text-center text-sm font-semibold tabular-nums text-slate-900`}>
                      {formatSheetValue(subjectResult?.percent ?? null)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <GradeChip grade={subjectResult?.grade ?? '-'} />
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={student.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-sm text-slate-600">{index + 1}</td>
                  <td className="sticky left-16 z-10 bg-inherit px-3 py-2 text-sm font-medium text-slate-900">{student.full_name}</td>
                  {assessments.map((item) => {
                    const row = assessmentResult(item.id);
                    return (
                      <Fragment key={item.id}>
                        {markInput(student, item)}
                        <td className={valueCellClass}>{formatPercent(row?.percent ?? null)}</td>
                        <td className="px-3 py-2 text-center">
                          <GradeChip grade={row?.grade ?? '-'} />
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className={`${sectionBorder} ${valueCellClass}`}>
                    {subjectResult?.obtained ?? 0} / {subjectResult?.maxTotal ?? 0}
                  </td>
                  <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums text-slate-900">
                    {formatPercent(subjectResult?.percent ?? null)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <GradeChip grade={subjectResult?.grade ?? '-'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatSheetValue(value: number | null): string {
  return value === null ? '-' : String(Math.round(value));
}

function GradeChip({ grade }: { grade: string }) {
  return (
    <span className={`inline-flex min-w-[2.75rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${gradeBadgeClass(grade)}`}>
      {grade}
    </span>
  );
}

function MarkInput({
  value,
  invalid,
  max,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  invalid: boolean;
  max: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const stateClass = invalid
    ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500/20'
    : 'border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-blue-600/20';

  return (
    <td className={`${sectionBorder} px-3 py-2 text-center`}>
      <input
        type="text"
        disabled={disabled}
        inputMode="decimal"
        value={value}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        placeholder={`/${max}`}
        onChange={(event) => onChange(event.target.value)}
        className={`${cellInputBase} ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500' : stateClass}`}
      />
    </td>
  );
}
