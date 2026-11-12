import { useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronDown, KeyRound, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { classLabel, type ClassOption } from '@/lib/school';
import { supabase } from '@/lib/supabase';
import { deleteTeacherAccount, setStaffPassword, updateStaffRole, updateTeacherName } from '@/lib/staff';
import type { Profile, Subject } from '@/lib/types';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';
import { useAuth } from '@/context/AuthContext';

const iconButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]';

export function TeacherCard({
  teacher,
  subjects,
  classes,
  assignments,
  open,
  onToggleOpen,
  onAssignmentsChange,
  onChanged,
  onError,
}: {
  teacher: Profile;
  subjects: Subject[];
  classes: ClassOption[];
  assignments: Set<string>;
  open: boolean;
  onToggleOpen: () => void;
  onAssignmentsChange: (next: Set<string>) => void;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(teacher.full_name);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { profile: currentProfile } = useAuth();
  const canChangeRoles = currentProfile?.role === 'super_admin';

  const assignedCount = useMemo(
    () => subjects.filter((subject) => assignments.has(`${teacher.id}|${subject.id}`)).length,
    [subjects, assignments, teacher.id],
  );

  const gradeGroups = useMemo(() => {
    const groups = new Map<string, Subject[]>();
    subjects.forEach((subject) => {
      groups.set(subject.class_name, [...(groups.get(subject.class_name) ?? []), subject]);
    });
    return [...groups.entries()].sort(
      ([a], [b]) => classes.findIndex((item) => item.value === a) - classes.findIndex((item) => item.value === b),
    );
  }, [subjects, classes]);

  const toggle = async (subjectId: string, checked: boolean) => {
    const key = `${teacher.id}|${subjectId}`;
    onError(null);
    const { error } = checked
      ? await supabase.from('teacher_subjects').insert({ teacher_id: teacher.id, subject_id: subjectId })
      : await supabase.from('teacher_subjects').delete().eq('teacher_id', teacher.id).eq('subject_id', subjectId);
    if (error) {
      onError(error.message);
      return;
    }
    const next = new Set(assignments);
    if (checked) next.add(key);
    else next.delete(key);
    onAssignmentsChange(next);
  };

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    const next = name.trim();
    if (!next) return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      await updateTeacherName(teacher.id, next);
      setRenaming(false);
      onChanged();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Could not update the name.');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleRoleChange = async (nextRole: Profile['role']) => {
    if (!canChangeRoles || nextRole === teacher.role || teacher.id === currentProfile?.id) return;
    setRoleSaving(true);
    setRoleError(null);
    try {
      await updateStaffRole(teacher.id, nextRole);
      onChanged();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Could not update this staff role.');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleSetPassword = async () => {
    if (!password || password.length < 8) {
      setPasswordError('The password must be at least 8 characters.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await setStaffPassword(teacher.id, password);
      setPassword('');
      setPasswordDone(true);
    } catch (err) {
      setPasswordDone(false);
      setPasswordError(err instanceof Error ? err.message : 'Could not set the password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteTeacherAccount(teacher.id);
      setConfirmingDelete(false);
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this teacher.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex items-center gap-3 px-5 py-4">
        {renaming ? (
          <form onSubmit={handleRename} className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Teacher name"
              className={`${inputClass} max-w-xs`}
              autoFocus
              required
            />
            <button type="submit" disabled={renameSaving} className={primaryButtonClass}>
              <Check className="h-4 w-4" aria-hidden />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setName(teacher.full_name);
                setRenameError(null);
              }}
              className={secondaryButtonClass}
            >
              <X className="h-4 w-4" aria-hidden />
              Cancel
            </button>
            {renameError && <p className="w-full text-sm text-red-700">{renameError}</p>}
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleOpen}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900">{teacher.full_name}</span>
                <span className="block truncate text-sm text-slate-500">{teacher.email}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${teacher.role === 'super_admin' ? 'bg-teal-100 text-teal-800' : teacher.role === 'admin' ? 'bg-sky-100 text-sky-800' : 'bg-blue-50 text-blue-800'}`}>
                  {teacher.role === 'super_admin' ? 'Super admin' : teacher.role === 'admin' ? 'Admin' : 'Teacher'}
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                  {assignedCount} subject{assignedCount === 1 ? '' : 's'}
                </span>
                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
              </span>
            </button>
            {canChangeRoles ? (
              <select
                value={teacher.role}
                onChange={(event) => void handleRoleChange(event.target.value as Profile['role'])}
                disabled={roleSaving || teacher.id === currentProfile?.id}
                aria-label={`Role for ${teacher.full_name}`}
                title={teacher.id === currentProfile?.id ? 'You cannot change your own role' : undefined}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
            ) : null}
            <button
              type="button"
              aria-label={`Edit name of ${teacher.full_name}`}
              onClick={() => {
                setName(teacher.full_name);
                setRenaming(true);
              }}
              className={iconButtonClass}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Delete ${teacher.full_name}`}
              onClick={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
              className={`${iconButtonClass} hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
      </div>

      {roleError && <p className="border-t border-slate-100 px-5 py-3 text-sm text-red-700">{roleError}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSetPassword();
        }}
        className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3"
      >
        <KeyRound className="h-4 w-4 text-slate-400" aria-hidden />
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordDone(false);
            setPasswordError(null);
          }}
          placeholder="Set a new password (8+ characters)"
          autoComplete="new-password"
          aria-label={`New password for ${teacher.full_name}`}
          className={`${inputClass} max-w-xs`}
        />
        <button type="submit" disabled={passwordSaving || password.length === 0} className={primaryButtonClass}>
          <Check className="h-4 w-4" aria-hidden />
          {passwordSaving ? 'Saving...' : 'Save password'}
        </button>
        {passwordDone && <span className="text-sm font-medium text-emerald-700">Password updated</span>}
        {passwordError && <span className="text-sm text-red-700">{passwordError}</span>}
      </form>

      {open && !renaming && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-5">
          <p className="text-sm text-slate-600">Tick the subjects this teacher may enter marks for.</p>
          {gradeGroups.map(([classCode, items]) => (
            <div key={classCode}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{classLabel(classCode, classes)}</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {items.map((subject) => {
                  const checked = assignments.has(`${teacher.id}|${subject.id}`);
                  return (
                    <label
                      key={subject.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        checked ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => void toggle(subject.id, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      {subject.name}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {teacher.role !== 'teacher' && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-sky-700" aria-hidden />
          {teacher.role === 'super_admin'
            ? 'Super admin access includes backups, restores, and all admin areas.'
            : 'Admin access includes all school management areas.'}
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this teacher?"
          confirmLabel="Delete teacher"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
        >
          <p>
            <span className="font-semibold text-slate-900">{teacher.full_name}</span> will no longer be able to sign in, and their
            subject assignments will be removed.
          </p>
          <p className="mt-2">Marks they already entered stay in the marks sheets.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
