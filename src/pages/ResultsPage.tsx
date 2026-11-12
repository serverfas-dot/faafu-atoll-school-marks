import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { EmptyState, Notice, PageHeader, Spinner } from '@/components/ui';
import { ClassSemesterPicker } from '@/components/ClassSemesterPicker';
import { ResultTable } from '@/components/results/ResultTable';
import { computeGradeResults } from '@/lib/grading';
import { classLabel, semesterLabel } from '@/lib/school';
import { useClassSemesterData } from '@/lib/useClassSemesterData';
import { useClasses } from '@/lib/useClasses';
import { cardClass, secondaryButtonClass } from '@/lib/styles';

export default function ResultsPage() {
  const [classCode, setClassCode] = useState('1');
  const [semester, setSemester] = useState(2);
  const { classes } = useClasses();
  const { data, loading, error } = useClassSemesterData(classCode, semester);
  const classOption = classes.find((item) => item.value === classCode);

  useEffect(() => {
    if (classes.length > 0 && !classOption) setClassCode(classes[0].value);
  }, [classes, classOption]);

  const rows = useMemo(() => {
    if (!data) return [];
    const { results, ranks } = computeGradeResults(data, classCode, classOption?.sheetKind);
    return data.students.map((student, index) => {
      const result = results[index];
      return { index: index + 1, student, result, rank: ranks.get(result.studentId) ?? null };
    });
  }, [data, classCode, classOption?.sheetKind]);

  return (
    <>
      <PageHeader
        title="Result sheet"
        description="The full class result for one semester: every subject, the average, the final grade and the rank."
        action={
          <button type="button" onClick={() => window.print()} className={`${secondaryButtonClass} print:hidden`}>
            <Printer className="h-4 w-4" aria-hidden />
            Print sheet
          </button>
        }
      />

      <div className="mb-6 grid gap-4 print:hidden lg:grid-cols-[480px_1fr] lg:items-start">
        <div className={`${cardClass} p-5`}>
          <ClassSemesterPicker
            classes={classes}
            classCode={classCode}
            semester={semester}
            onClassChange={setClassCode}
            onSemesterChange={setSemester}
          />
        </div>
        {data && (
          <p className="text-sm text-slate-600 lg:pt-6">
            {classLabel(classCode, classes)} - {semesterLabel(semester)} - {data.students.length} students, {data.subjects.length}{' '}
            subjects
          </p>
        )}
      </div>

      {loading && !data ? (
        <Spinner label="Loading result sheet..." />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : rows.length === 0 ? (
        <EmptyState title="No students yet" description="Students for this class will appear here once the admin adds them." />
      ) : data && data.subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="Subjects for this class have not been added yet." />
      ) : (
        <ResultTable subjects={data?.subjects ?? []} rows={rows} removeFinalPercent={classOption?.sheetKind !== 'secondary'} />
      )}
    </>
  );
}
