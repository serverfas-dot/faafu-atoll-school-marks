import { useState, type FormEvent } from 'react';
import { Check, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import { AssessmentItem } from '@/components/admin/AssessmentItem';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Notice, SelectField, TextField } from '@/components/ui';
import { countMarks } from '@/lib/adminCounts';
import { ASSESSMENT_PART_OPTIONS, sheetKindFor } from '@/lib/grading';
import { SEMESTERS } from '@/lib/school';
import { supabase } from '@/lib/supabase';
import type { Assessment, AssessmentPart, Subject } from '@/lib/types';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';

const iconButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]';

export function SubjectCard({
  subject,
  assessments,
  onChanged,
  onError,
}: {
  subject: Subject;
  assessments: Assessment[];
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(subject.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pendingMarks, setPendingMarks] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    setRenameSaving(true);
    setRenameError(null);
    const { error } = await supabase.from('subjects').update({ name: next }).eq('id', subject.id);
    setRenameSaving(false);
    if (error) {
      setRenameError(error.message.includes('duplicate') ? `${next} already exists in this class.` : error.message);
      return;
    }
    setRenaming(false);
    onChanged();
  };

  const cancelRename = () => {
    setRenaming(false);
    setName(subject.name);
    setRenameError(null);
  };

  const requestDelete = async () => {
    try {
      setPendingMarks(await countMarks({ subjectId: subject.id }));
      setDeleteError(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not check this subject.');
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    const { error } = await supabase.from('subjects').delete().eq('id', subject.id);
    setDeleteBusy(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setPendingMarks(null);
    onChanged();
  };

  const assessmentCount = assessments.length;
  const secondary = sheetKindFor(subject.class_name) === 'secondary';

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center gap-3 px-5 py-4">
        {renaming ? (
          <form onSubmit={handleRename} className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Subject name"
              className={`${inputClass} max-w-xs`}
              autoFocus
              required
            />
            <button type="submit" disabled={renameSaving} className={primaryButtonClass}>
              <Check className="h-4 w-4" aria-hidden />
              Save
            </button>
            <button type="button" onClick={cancelRename} className={secondaryButtonClass}>
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </button>
            {renameError && <p className="w-full text-sm text-red-700">{renameError}</p>}
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900">{subject.name}</span>
                <span className="text-sm text-slate-500">
                  {assessmentCount} assessment{assessmentCount === 1 ? '' : 's'}
                </span>
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Rename ${subject.name}`}
              onClick={() => setRenaming(true)}
              className={iconButtonClass}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Delete ${subject.name}`}
              onClick={() => void requestDelete()}
              className={`${iconButtonClass} hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
      </div>

      {open && !renaming && (
        <div className="space-y-6 border-t border-slate-100 px-5 py-5">
          {SEMESTERS.map((semester) => {
            const semesterItems = assessments
              .filter((item) => item.semester === semester.value)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={semester.value}>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">
                  {semester.label} <span className="font-normal text-slate-500">({semester.dates})</span>
                </h3>
                {semesterItems.length === 0 ? (
                  <p className="mb-3 text-sm text-slate-500">No assessments yet.</p>
                ) : (
                  <ul className="mb-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                    {semesterItems.map((item) => (
                      <AssessmentItem
                        key={item.id}
                        item={item}
                        secondary={secondary}
                        onChanged={onChanged}
                        onError={onError}
                      />
                    ))}
                  </ul>
                )}
                <AssessmentForm
                  subjectId={subject.id}
                  semester={semester.value}
                  nextSortOrder={semesterItems.length + 1}
                  secondary={secondary}
                  onAdded={onChanged}
                  onError={onError}
                />
              </div>
            );
          })}
        </div>
      )}

      {pendingMarks !== null && (
        <ConfirmDialog
          title="Delete this subject?"
          confirmLabel="Delete subject"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingMarks(null)}
        >
          <p>
            <span className="font-semibold text-slate-900">{subject.name}</span> and its {assessmentCount} assessment
            {assessmentCount === 1 ? '' : 's'} will be removed permanently.
          </p>
          <p className="mt-2">
            {pendingMarks === 0
              ? 'No marks have been entered for it.'
              : `${pendingMarks} entered mark${pendingMarks === 1 ? '' : 's'} will also be deleted.`}
          </p>
          <p className="mt-2">Teachers will no longer be assigned to this subject.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function AssessmentForm({
  subjectId,
  semester,
  nextSortOrder,
  secondary,
  onAdded,
  onError,
}: {
  subjectId: string;
  semester: number;
  nextSortOrder: number;
  secondary: boolean;
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [maxMark, setMaxMark] = useState('25');
  const [weight, setWeight] = useState('50');
  const [part, setPart] = useState<AssessmentPart>('unit');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const max = Number(maxMark);
    const points = Number(weight);
    if (!name.trim() || !(max > 0) || !(points > 0)) {
      setFormError('Enter a name, a maximum mark and a weight greater than zero.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const { error } = await supabase.from('assessments').insert({
      subject_id: subjectId,
      semester,
      name: name.trim(),
      max_mark: max,
      weight: points,
      sort_order: nextSortOrder,
      part: secondary ? part : 'unit',
    });
    setSaving(false);
    if (error) {
      setFormError(error.message.includes('duplicate') ? `"${name.trim()}" already exists for this semester.` : error.message);
      return;
    }
    setName('');
    onError(null);
    onAdded();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
        <TextField label="Assessment name" value={name} onChange={setName} />
        <TextField label="Out of" type="number" value={maxMark} onChange={setMaxMark} />
        {secondary ? (
          <SelectField label="Part" value={part} onChange={(value) => setPart(value as AssessmentPart)}>
            {ASSESSMENT_PART_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField label="Weight (points of 100)" type="number" value={weight} onChange={setWeight} />
        )}
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          Add
        </button>
      </div>
      {formError && <Notice tone="error">{formError}</Notice>}
    </form>
  );
}
