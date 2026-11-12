import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState, Notice, Spinner, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useClasses } from '@/lib/useClasses';
import type { ClassOption } from '@/lib/school';
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass } from '@/lib/styles';

export function ClassesManager() {
  const { classes, loading, error: classesError, reload } = useClasses();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [sheetKind, setSheetKind] = useState<'primary' | 'secondary'>('primary');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClassOption | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const nextCode = code.trim().toUpperCase();
    const nextLabel = label.trim();
    if (!nextCode || !nextLabel) return;
    setSaving(true);
    setError(null);
    const sortOrder = Math.max(0, ...classes.map((item) => item.sortOrder)) + 1;
    const { error: insertError } = await supabase.from('classes').insert({
      code: nextCode,
      label: nextLabel,
      sheet_kind: sheetKind,
      sort_order: sortOrder,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message.includes('duplicate') ? `${nextCode} already exists.` : insertError.message);
      return;
    }
    setCode('');
    setLabel('');
    setSheetKind('primary');
    reload();
  };

  const requestDelete = async (classOption: ClassOption) => {
    setError(null);
    const [studentsRes, subjectsRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_name', classOption.value),
      supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('class_name', classOption.value),
    ]);
    const queryError = studentsRes.error ?? subjectsRes.error;
    if (queryError) {
      setError(queryError.message);
      return;
    }
    const studentCount = studentsRes.count ?? 0;
    const subjectCount = subjectsRes.count ?? 0;
    if (studentCount > 0 || subjectCount > 0) {
      setError(
        `${classOption.label} cannot be deleted yet. Remove its ${studentCount ? `${studentCount} student${studentCount === 1 ? '' : 's'}` : ''}${studentCount && subjectCount ? ' and ' : ''}${subjectCount ? `${subjectCount} subject${subjectCount === 1 ? '' : 's'}` : ''} first.`,
      );
      return;
    }
    setDeleteError(null);
    setPendingDelete(classOption);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('classes').delete().eq('code', pendingDelete.value);
    setDeleteBusy(false);
    if (deleteErr) {
      setDeleteError(deleteErr.message);
      return;
    }
    setPendingDelete(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className={`${cardClass} space-y-4 p-5`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Add a class</h2>
          <p className="mt-1 text-sm text-slate-500">New classes will appear in all student, subject, marks and result selectors.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_180px_auto] sm:items-end">
          <TextField label="Class code" value={code} onChange={setCode} required />
          <TextField label="Class name" value={label} onChange={setLabel} required />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Marks sheet</span>
            <select value={sheetKind} onChange={(event) => setSheetKind(event.target.value as 'primary' | 'secondary')} className={inputClass}>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary (30% + 70%)</option>
            </select>
          </label>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            <Plus className="h-4 w-4" aria-hidden />
            Add class
          </button>
        </div>
      </form>

      {(classesError || error) && <Notice tone="error">{classesError ?? error}</Notice>}

      {loading ? (
        <Spinner />
      ) : classes.length === 0 ? (
        <EmptyState title="No classes yet" description="Add a class above to start managing students and subjects." />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <ul className="divide-y divide-slate-100">
            {classes.map((classOption) => (
              <li key={classOption.value} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">{classOption.label}</p>
                  <p className="text-sm text-slate-500">
                    Code {classOption.value} · {classOption.sheetKind === 'secondary' ? 'Secondary 30% + 70%' : 'Primary marks sheet'}
                  </p>
                </div>
                <button type="button" onClick={() => void requestDelete(classOption)} className={dangerButtonClass}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.label}?`}
          confirmLabel="Delete class"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        >
          <p>This class has no students or subjects and can be safely removed.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
