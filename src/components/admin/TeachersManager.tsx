import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { TeacherCard } from '@/components/admin/TeacherCard';
import { EmptyState, Notice, Spinner, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { createTeacherAccount } from '@/lib/staff';
import type { Profile, Subject } from '@/lib/types';
import { cardClass, primaryButtonClass } from '@/lib/styles';
import { useClasses } from '@/lib/useClasses';

type Assignment = { teacher_id: string; subject_id: string };

export function TeachersManager() {
  const [teachers, setTeachers] = useState<Profile[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Set<string> | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { classes } = useClasses();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [teacherRes, subjectRes, assignmentRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role').in('role', ['teacher', 'admin', 'super_admin']).order('full_name'),
        supabase.from('subjects').select('id, name, class_name, sort_order').order('class_name').order('sort_order'),
        supabase.from('teacher_subjects').select('teacher_id, subject_id'),
      ]);
      if (cancelled) return;
      const failed = teacherRes.error ?? subjectRes.error ?? assignmentRes.error;
      if (failed) {
        setError(failed.message);
        return;
      }
      setError(null);
      setTeachers((teacherRes.data ?? []) as Profile[]);
      setSubjects((subjectRes.data ?? []) as Subject[]);
      const rows = (assignmentRes.data ?? []) as Assignment[];
      setAssignments(new Set(rows.map((row) => `${row.teacher_id}|${row.subject_id}`)));
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  return (
    <div className="space-y-6">
      <CreateTeacherForm onCreated={() => setVersion((value) => value + 1)} />

      {error && <Notice tone="error">{error}</Notice>}

      {teachers === null || assignments === null ? (
        <Spinner />
      ) : teachers.length === 0 ? (
        <EmptyState title="No staff yet" description="Create a teacher account above, then assign their subjects or promote them to admin." />
      ) : (
        <div className="space-y-3">
          {teachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              subjects={subjects}
              classes={classes}
              assignments={assignments}
              open={expandedId === teacher.id}
              onToggleOpen={() => setExpandedId(expandedId === teacher.id ? null : teacher.id)}
              onAssignmentsChange={setAssignments}
              onChanged={() => setVersion((value) => value + 1)}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTeacherForm({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await createTeacherAccount(fullName.trim(), email.trim(), password);
      setMessage({ tone: 'success', text: `${fullName.trim()} can now sign in with the email and password you set.` });
      setFullName('');
      setEmail('');
      setPassword('');
      onCreated();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not create the teacher account.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-4 p-5`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Add a teacher</h2>
        <p className="text-sm text-slate-500">Create a sign-in for a teacher, then assign the subjects they teach below.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Full name" value={fullName} onChange={setFullName} />
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="off" />
        <TextField label="Temporary password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        <UserPlus className="h-4 w-4" aria-hidden />
        {submitting ? 'Creating...' : 'Create teacher account'}
      </button>
    </form>
  );
}
