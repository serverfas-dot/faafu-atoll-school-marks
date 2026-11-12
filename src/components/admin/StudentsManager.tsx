import { useEffect, useState, type FormEvent } from 'react';
import { Check, ImagePlus, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { EmptyState, Notice, SelectField, Spinner } from '@/components/ui';
import { countMarks } from '@/lib/adminCounts';
import { supabase } from '@/lib/supabase';
import { StudentPhoto } from '@/components/report/StudentPhoto';
import { useClasses } from '@/lib/useClasses';
import { sortStudents } from '@/lib/marksData';
import { uploadStudentPhoto } from '@/lib/studentPhotos';
import type { Student } from '@/lib/types';
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';

export function StudentsManager() {
  const { classes } = useClasses();
  const [classCode, setClassCode] = useState('1');
  const [students, setStudents] = useState<Student[] | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ student: Student; marks: number } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (classes.length > 0 && !classes.some((item) => item.value === classCode)) setClassCode(classes[0].value);
  }, [classes, classCode]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('students')
      .select('id, full_name, roll_no, class_name, photo_url')
      .eq('class_name', classCode)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setError(null);
        setStudents(sortStudents((data ?? []) as Student[]));
      });
    return () => {
      cancelled = true;
    };
  }, [classCode, version]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('students')
      .insert({ full_name: name, roll_no: rollNo.trim(), class_name: classCode });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setFullName('');
    setRollNo('');
    setVersion((value) => value + 1);
  };

  const handleSaveEdit = async (studentId: string) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from('students')
      .update({ full_name: name, roll_no: editRoll.trim() })
      .eq('id', studentId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingId(null);
    setVersion((value) => value + 1);
  };

  const handlePhotoChange = async (student: Student, file: File | null) => {
    setPhotoBusyId(student.id);
    setError(null);
    try {
      if (!file) {
        const { error: clearError } = await supabase.from('students').update({ photo_url: null }).eq('id', student.id);
        if (clearError) throw new Error(clearError.message);
      } else {
        await uploadStudentPhoto(student.id, file);
      }
      setVersion((value) => value + 1);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not save the photo. Use an image up to 5 MB.');
    } finally {
      setPhotoBusyId(null);
    }
  };

  const requestDelete = async (student: Student) => {
    setError(null);
    try {
      const marks = await countMarks({ studentId: student.id });
      setDeleteError(null);
      setPendingDelete({ student, marks });
    } catch (countError) {
      setError(countError instanceof Error ? countError.message : 'Could not check this student.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('students').delete().eq('id', pendingDelete.student.id);
    setDeleteBusy(false);
    if (deleteErr) {
      setDeleteError(deleteErr.message);
      return;
    }
    setPendingDelete(null);
    setVersion((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <SelectField label="Class" value={classCode} onChange={setClassCode}>
          {classes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>
      </div>

      <form onSubmit={handleAdd} className={`${cardClass} grid gap-3 p-5 sm:grid-cols-[1fr_180px_auto] sm:items-end`}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Student name</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Index number</span>
          <input value={rollNo} onChange={(event) => setRollNo(event.target.value)} className={inputClass} />
        </label>
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Add student
        </button>
      </form>

      {error && <Notice tone="error">{error}</Notice>}

      {students === null ? (
        <Spinner />
      ) : students.length === 0 ? (
        <EmptyState title="No students in this grade" description="Add the first student using the form above." />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <ul className="divide-y divide-slate-100">
            {students.map((student) =>
              editingId === student.id ? (
                <li key={student.id} className="grid gap-3 bg-blue-50/40 p-4 sm:grid-cols-[1fr_160px_auto] sm:items-center">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    aria-label="Student name"
                    className={inputClass}
                  />
                  <input
                    value={editRoll}
                    onChange={(event) => setEditRoll(event.target.value)}
                    aria-label="Index number"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleSaveEdit(student.id)} disabled={saving} className={primaryButtonClass}>
                      <Check className="h-4 w-4" aria-hidden />
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={secondaryButtonClass}>
                      <X className="h-4 w-4" aria-hidden />
                      Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li key={student.id} className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <StudentPhoto fullName={student.full_name} photoUrl={student.photo_url} className="h-10 w-10 rounded-xl" textClass="text-xs" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{student.full_name}</p>
                      <p className="text-sm text-slate-500">Index No {student.roll_no || '-'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className={`${secondaryButtonClass} cursor-pointer ${photoBusyId === student.id ? 'opacity-50' : ''}`}>
                      <ImagePlus className="h-4 w-4" aria-hidden />
                      {photoBusyId === student.id ? 'Saving...' : 'Photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = '';
                          if (file) void handlePhotoChange(student, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(student.id);
                        setEditName(student.full_name);
                        setEditRoll(student.roll_no);
                      }}
                      className={secondaryButtonClass}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </button>
                    <button type="button" onClick={() => void requestDelete(student)} className={dangerButtonClass}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Delete
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this student?"
          confirmLabel="Delete student"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            <span className="font-semibold text-slate-900">{pendingDelete.student.full_name}</span> will be removed permanently.
          </p>
          <p className="mt-2">
            {pendingDelete.marks === 0
              ? 'This student has no marks recorded.'
              : `${pendingDelete.marks} recorded mark${pendingDelete.marks === 1 ? '' : 's'} will also be deleted.`}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
