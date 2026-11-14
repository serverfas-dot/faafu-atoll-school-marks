import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Notice, PageHeader, Spinner, SelectField } from '@/components/ui';
import { MarksGrid } from '@/components/marks/MarksGrid';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildMarkIndex, sheetKindFor } from '@/lib/grading';
import { MARKS_SHEET_YEAR, SEMESTERS, semesterLabel } from '@/lib/school';
import { useSchoolYears } from '@/lib/useSchoolYears';
import { formatWindowDate, isMarkEntryWindowOpen, listMarkEntryWindows, type MarkEntryWindow } from '@/lib/markEntryWindows';
import { useClasses } from '@/lib/useClasses';
import { cardClass } from '@/lib/styles';
import { useClassSemesterData } from '@/lib/useClassSemesterData';

export default function MarksEntryPage() {
  const { profile, isAdmin } = useAuth();
  const { classes } = useClasses();
  const { years, defaultYear, error: yearsError } = useSchoolYears();
  const [classCode, setClassCode] = useState('1');
  const [schoolYear, setSchoolYear] = useState(MARKS_SHEET_YEAR);
  const [semester, setSemester] = useState(2);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [assignedIds, setAssignedIds] = useState<string[] | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [entryWindow, setEntryWindow] = useState<MarkEntryWindow | null>(null);
  const [windowLoading, setWindowLoading] = useState(true);
  const [windowError, setWindowError] = useState<string | null>(null);
  const { data, loading, error, reload } = useClassSemesterData(classCode, schoolYear, semester);
  const classOption = classes.find((item) => item.value === classCode);

  useEffect(() => {
    if (classes.length > 0 && !classOption) setClassCode(classes[0].value);
  }, [classes, classOption]);

  useEffect(() => {
    if (years.length > 0 && !years.some((item) => item.year === schoolYear)) setSchoolYear(defaultYear);
  }, [defaultYear, schoolYear, years]);

  useEffect(() => {
    let cancelled = false;
    setWindowLoading(true);
    setWindowError(null);
    listMarkEntryWindows(schoolYear)
      .then((rows) => {
        if (!cancelled) setEntryWindow(rows.find((row) => row.semester === semester) ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setWindowError(err instanceof Error ? err.message : 'Could not check the mark entry window.');
      })
      .finally(() => {
        if (!cancelled) setWindowLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolYear, semester]);

  useEffect(() => {
    if (!profile || isAdmin) return;
    let cancelled = false;
    supabase
      .from('teacher_subjects')
      .select('subject_id')
      .eq('teacher_id', profile.id)
      .then(({ data: rows, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setAssignmentError(queryError.message);
          return;
        }
        setAssignedIds((rows ?? []).map((row) => row.subject_id as string));
      });
    return () => {
      cancelled = true;
    };
  }, [profile, isAdmin]);

  const windowOpen = isMarkEntryWindowOpen(entryWindow);
  const canEditMarks = isAdmin || windowOpen;

  const visibleSubjects = useMemo(() => {
    if (!data) return [];
    if (isAdmin) return data.subjects;
    return data.subjects.filter((subject) => (assignedIds ?? []).includes(subject.id));
  }, [data, assignedIds, isAdmin]);

  const activeSubject = visibleSubjects.find((subject) => subject.id === selectedSubjectId) ?? visibleSubjects[0];

  const subjectAssessments = useMemo(
    () => (data && activeSubject ? data.assessments.filter((item) => item.subject_id === activeSubject.id) : []),
    [data, activeSubject],
  );

  const savedMarks = useMemo(() => buildMarkIndex(data?.marks ?? []), [data]);
  const assignmentsReady = isAdmin || assignedIds !== null || assignmentError !== null;

  return (
    <>
      <PageHeader
        title="Marks entry"
        description="Choose your class, semester and subject. Enter marks during the open entry window; percentages, grades and totals are calculated for you."
      />

      <div className={`${cardClass} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Class"
            value={classCode}
            onChange={(value) => {
              setClassCode(value);
              setSelectedSubjectId('');
            }}
          >
            {classes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Year" value={String(schoolYear)} onChange={(value) => setSchoolYear(Number(value))}>
            {years.length === 0 ? <option value={String(MARKS_SHEET_YEAR)}>{MARKS_SHEET_YEAR}</option> : years.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}
          </SelectField>
          <SelectField label="Semester" value={String(semester)} onChange={(value) => setSemester(Number(value))}>
            {SEMESTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label} ({item.dates})
              </option>
            ))}
          </SelectField>
          {visibleSubjects.length > 0 && (
            <SelectField label="Subject" value={activeSubject?.id ?? ''} onChange={setSelectedSubjectId}>
              {visibleSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </div>

      {yearsError && <Notice tone="error">{yearsError}</Notice>}
      {assignmentError && <Notice tone="error">{assignmentError}</Notice>}
      {windowError && <Notice tone="error">{windowError}</Notice>}
      {!isAdmin && !windowLoading && !windowError && (
        <Notice tone={windowOpen ? 'success' : 'info'}>
          {entryWindow
            ? windowOpen
              ? `Marks entry is open from ${formatWindowDate(entryWindow.opens_at)} until ${formatWindowDate(entryWindow.closes_at)}. You can save marks only for subjects assigned to you.`
              : `Marks entry is closed. This semester was scheduled from ${formatWindowDate(entryWindow.opens_at)} until ${formatWindowDate(entryWindow.closes_at)}. The admin must set a new window before teachers can save marks.`
            : `No marks-entry window has been set for ${schoolYear} ${semesterLabel(semester)}. Teachers can view marks but cannot save changes until the admin sets opening and closing times.`}
        </Notice>
      )}

      {(loading && !data) || !assignmentsReady || windowLoading ? (
        <Spinner label="Loading marks sheet..." />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : !data || data.subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="The admin has not added subjects for this class." />
      ) : visibleSubjects.length === 0 ? (
        <EmptyState title="No subjects assigned" description="You are not assigned to any subject in this class. Ask the admin to assign your subjects." />
      ) : data.students.length === 0 ? (
        <EmptyState title="No students yet" description="The admin has not added students to this class." />
      ) : subjectAssessments.length === 0 || !activeSubject ? (
        <EmptyState
          title={`No assessments for ${semesterLabel(semester)}`}
          description="The admin has not set up assessments for this subject and semester yet."
        />
      ) : (
        <MarksGrid
          key={`${classCode}-${schoolYear}-${semester}-${activeSubject.id}`}
          students={data.students}
          subject={activeSubject}
          schoolYear={schoolYear}
          assessments={subjectAssessments}
          savedMarks={savedMarks}
          sheet={sheetKindFor(classCode, classOption?.sheetKind)}
          allowClearAllMarks={isAdmin}
          canEditMarks={canEditMarks}
          onSaved={reload}
        />
      )}
    </>
  );
}
