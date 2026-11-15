import { useState } from 'react';
import { Check, Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Notice, SelectField, TextField } from '@/components/ui';
import { countMarks } from '@/lib/adminCounts';
import { ASSESSMENT_PART_OPTIONS } from '@/lib/grading';
import { supabase } from '@/lib/supabase';
import type { Assessment, AssessmentPart } from '@/lib/types';
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';

export function AssessmentItem({
  item,
  secondary,
  onChanged,
  onError,
}: {
  item: Assessment;
  secondary: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [maxMark, setMaxMark] = useState(String(item.max_mark));
  const [weight, setWeight] = useState(String(item.weight));
  const [sortOrder, setSortOrder] = useState(String(item.sort_order));
  const [part, setPart] = useState<AssessmentPart>(item.part);
  const [isActive, setIsActive] = useState(item.is_active);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingMarks, setPendingMarks] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const toggleActive = async () => {
    setToggleBusy(true);
    const { error: toggleError } = await supabase
      .from('assessments')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    setToggleBusy(false);
    if (toggleError) {
      onError('Could not change this assessment. Please try again.');
      return;
    }
    onChanged();
  };

  const startEditing = () => {
    setName(item.name);
    setMaxMark(String(item.max_mark));
    setWeight(String(item.weight));
    setSortOrder(String(item.sort_order));
    setPart(item.part);
    setIsActive(item.is_active);
    setEditError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const max = Number(maxMark);
    const points = Number(weight);
    const order = Number(sortOrder);
    if (!trimmed || !(max > 0) || !(points > 0) || !Number.isInteger(order)) {
      setEditError('Enter a name, a maximum mark and a weight greater than zero, and a whole-number position.');
      return;
    }
    setSaving(true);
    setEditError(null);
    const { error } = await supabase
      .from('assessments')
      .update({ name: trimmed, max_mark: max, weight: points, sort_order: order, part: secondary ? part : item.part, is_active: isActive })
      .eq('id', item.id);
    setSaving(false);
    if (error) {
      setEditError(
        error.message.includes('duplicate')
          ? `"${trimmed}" already exists for this semester.`
          : error.message.includes('within_max') || error.message.includes('exceed')
            ? 'Some existing marks are higher than this maximum. Lower the marks first or keep the maximum.'
            : error.message,
      );
      return;
    }
    setEditing(false);
    onChanged();
  };

  const requestDelete = async () => {
    try {
      setPendingMarks(await countMarks({ assessmentId: item.id }));
      setDeleteError(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not check this assessment.');
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    const { error } = await supabase.from('assessments').delete().eq('id', item.id);
    setDeleteBusy(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setPendingMarks(null);
    onChanged();
  };

  return (
    <>
      {editing ? (
        <li className="space-y-3 bg-blue-50/40 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Name" value={name} onChange={setName} />
            <TextField label="Out of" type="number" value={maxMark} onChange={setMaxMark} />
            <TextField label={secondary ? 'Percentage points' : 'Weight (points of 100)'} type="number" value={weight} onChange={setWeight} />
            {secondary && (
              <SelectField label="Part" value={part} onChange={(value) => setPart(value as AssessmentPart)}>
                {ASSESSMENT_PART_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            )}
            <TextField label="Position" type="number" value={sortOrder} onChange={setSortOrder} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600" />
            Include in marks, totals, and reports
          </label>
          {editError && <Notice tone="error">{editError}</Notice>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className={primaryButtonClass}>
              <Check className="h-4 w-4" aria-hidden />
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </button>
          </div>
        </li>
      ) : (
        <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="flex items-center gap-2 truncate font-medium text-slate-800">
              <span className="truncate">{item.name}</span>
              {!item.is_active && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hidden</span>}
            </span>
            <span className="tabular-nums text-slate-500">
              Out of {item.max_mark}
              {secondary
                ? ` - ${item.part === 'term' ? 'term test' : 'unit test'} - ${item.weight} points`
                : ` - worth ${item.weight} points`}
              {` - position ${item.sort_order}`}
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void toggleActive()}
              disabled={toggleBusy}
              aria-label={item.is_active ? `Hide ${item.name}` : `Show ${item.name}`}
              className={secondaryButtonClass}
            >
              {item.is_active ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              {item.is_active ? 'Hide' : 'Show'}
            </button>
            <button type="button" onClick={startEditing} className={secondaryButtonClass}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </button>
            <button type="button" onClick={() => void requestDelete()} className={dangerButtonClass}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </button>
          </span>
          {pendingMarks !== null && (
            <ConfirmDialog
              title="Delete this assessment?"
              confirmLabel="Delete assessment"
              busy={deleteBusy}
              error={deleteError}
              onConfirm={() => void confirmDelete()}
              onCancel={() => setPendingMarks(null)}
            >
              <p>
                <span className="font-semibold text-slate-900">{item.name}</span> will be removed permanently.
              </p>
              <p className="mt-2">
                {pendingMarks === 0
                  ? 'No marks have been entered for it.'
                  : `${pendingMarks} entered mark${pendingMarks === 1 ? '' : 's'} will also be deleted.`}
              </p>
            </ConfirmDialog>
          )}
        </li>
      )}
    </>
  );
}
