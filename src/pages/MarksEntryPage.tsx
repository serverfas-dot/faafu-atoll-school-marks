import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Notice, PageHeader, Spinner, SelectField } from '@/components/ui';
import { MarksGrid } from '@/components/marks/MarksGrid';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildMarkIndex, sheetKindFor } from '@/lib/grading';
import { MARKS_SHEET_YEAR, SEMESTERS, semesterLabel } from '@/lib/school';
import { useSchoolYears } from '@/lib/useSchoolYears';
import { isMarkEntryWindowOpen, listAssessmentMarkEntryWindows, type AssessmentMarkEntryWindow } from '@/lib/markEntryWindows';
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
  const [entryWindows, setEntryWindows] = useState<AssessmentMarkEntryWindow[]>([]);
  const [windowLoading, setWindowLoading] = useState(true);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [windowNow, setWindowNow] = useState(() => new Date());
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
    listAssessmentMarkEntryWindows(schoolYear)
      .then((rows) => {
        if (!cancelled) setEntryWindows(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setWindowError(err instanceof Error ? err.message : 'Could not check assessment mark entry windows.');
      })
      .finally(() => {
        if (!cancelled) setWindowLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolYear]);

  useEffect(() => {
    const timer = window.setInterval(() => setWindowNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const openAssessmentIds = useMemo(
    () => new Set(entryWindows.filter((entryWindow) => entryWindow.semester === semester && isMarkEntryWindowOpen(entryWindow, windowNow)).map((entryWindow) => entryWindow.assessment_id)),
    [entryWindows, semester, windowNow],
  );
  const canEditMarks = isAdmin || openAssessmentIds.size > 0;

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

  const openWindowLabels = useMemo(() => {
    if (!data) return [];
    const nameById = new Map(data.assessments.map((item) => [item.id, item.name]));
    return entryWindows
      .filter((entryWindow) => entryWindow.semester === semester && isMarkEntryWindowOpen(entryWindow, windowNow))
      .map((entryWindow) => nameById.get(entryWindow.assessment_id))
      .filter((name): name is string => Boolean(name));
  }, [data, entryWindows, semester, windowNow]);

  const activeVisibility = data?.visibility.find((row) => row.subject_id === activeSubject?.id);
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
        <Notice tone={openWindowLabels.length > 0 ? 'success' : 'info'}>
          {openWindowLabels.length > 0
            ? `Marks entry is open for: ${openWindowLabels.join(', ')}. You can type marks only for those assessments and only for subjects assigned to you. All other assessments are view-only.`
            : `Marks entry is closed for ${schoolYear} ${semesterLabel(semester)}. You can view the marks sheet, but you cannot save changes until the admin opens an assessment for entry.`}
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
          visibility={activeVisibility}
          allowClearAllMarks={isAdmin}
          canEditMarks={canEditMarks}
          editableAssessmentIds={isAdmin ? undefined : openAssessmentIds}
          onSaved={reload}
        />
      )}
    </>
  );
}
