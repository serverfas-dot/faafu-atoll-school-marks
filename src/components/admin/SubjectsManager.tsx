import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { SubjectCard } from '@/components/admin/SubjectCard';
import { EmptyState, Notice, SelectField, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useClasses } from '@/lib/useClasses';
import type { Assessment, Subject } from '@/lib/types';
import { cardClass, inputClass, primaryButtonClass } from '@/lib/styles';

export function SubjectsManager() {
  const { classes } = useClasses();
  const [classCode, setClassCode] = useState('1');
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (classes.length > 0 && !classes.some((item) => item.value === classCode)) setClassCode(classes[0].value);
  }, [classes, classCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: subjectRows, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name, class_name, sort_order')
        .eq('class_name', classCode)
        .order('sort_order');
      if (cancelled) return;
      if (subjectError) {
        setError(subjectError.message);
        return;
      }
      const list = (subjectRows ?? []) as Subject[];
      let items: Assessment[] = [];
      if (list.length > 0) {
        const { data: assessmentRows, error: assessmentError } = await supabase
          .from('assessments')
          .select('id, subject_id, semester, name, max_mark, weight, part, sort_order')
          .in('subject_id', list.map((subject) => subject.id))
          .order('sort_order');
        if (cancelled) return;
        if (assessmentError) {
          setError(assessmentError.message);
          return;
        }
        items = (assessmentRows ?? []) as Assessment[];
      }
      setError(null);
      setSubjects(list);
      setAssessments(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [classCode, version]);

  const handleAddSubject = async (event: FormEvent) => {
    event.preventDefault();
    const name = newSubjectName.trim();
    if (!name || !subjects) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('subjects')
      .insert({ name, class_name: classCode, sort_order: subjects.length + 1 });
    setSaving(false);
    if (insertError) {
      setError(insertError.message.includes('duplicate') ? `${name} already exists in this class.` : insertError.message);
      return;
    }
    setNewSubjectName('');
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

      <form onSubmit={handleAddSubject} className={`${cardClass} grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end`}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">New subject</span>
          <input
            value={newSubjectName}
            onChange={(event) => setNewSubjectName(event.target.value)}
            placeholder="e.g. Quran"
            className={inputClass}
            required
          />
        </label>
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          <Plus className="h-4 w-4" aria-hidden />
          Add subject
        </button>
      </form>

      {error && <Notice tone="error">{error}</Notice>}

      {subjects === null ? (
        <Spinner />
      ) : subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="Add the subjects taught in this grade, then set up their assessments." />
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              assessments={assessments.filter((item) => item.subject_id === subject.id)}
              onChanged={() => setVersion((value) => value + 1)}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
