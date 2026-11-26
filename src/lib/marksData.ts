import { supabase } from '@/lib/supabase';
import type { Assessment, GradeSemesterData, MarkRow, Student, Subject, SubjectResultVisibility } from '@/lib/types';

const PAGE_SIZE = 1000;

export function sortStudents(students: Student[]): Student[] {
  return [...students].sort(
    (a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }) ||
      a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true }),
  );
}

async function fetchMarks(assessmentIds: string[]): Promise<MarkRow[]> {
  if (assessmentIds.length === 0) return [];

  const rows: MarkRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('marks')
      .select('student_id, assessment_id, mark, absence_type')
      .in('assessment_id', assessmentIds)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as MarkRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function fetchClassSemester(classCode: string, schoolYear: number, semester: number): Promise<GradeSemesterData> {
  const [studentsRes, subjectsRes] = await Promise.all([
    supabase.from('students').select('id, full_name, roll_no, class_name, school_year, photo_url').eq('class_name', classCode).eq('school_year', schoolYear),
    supabase.from('subjects').select('id, name, class_name, sort_order').eq('class_name', classCode).order('sort_order'),
  ]);
  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (subjectsRes.error) throw new Error(subjectsRes.error.message);

  const students = sortStudents((studentsRes.data ?? []) as Student[]);
  const subjects = (subjectsRes.data ?? []) as Subject[];

  let assessments: Assessment[] = [];
  let visibility: SubjectResultVisibility[] = [];
  if (subjects.length > 0) {
    const { data, error } = await supabase
      .from('assessments')
      .select('id, subject_id, school_year, semester, name, max_mark, weight, part, sort_order, is_active')
      .eq('school_year', schoolYear)
      .eq('is_active', true)
      .eq('semester', semester)
      .in('subject_id', subjects.map((subject) => subject.id))
      .order('sort_order');
    if (error) throw new Error(error.message);
    assessments = (data ?? []) as Assessment[];

    const { data: visibilityRows, error: visibilityError } = await supabase
      .from('subject_result_visibility')
      .select('subject_id, school_year, semester, show_unit_points, show_term_marks, show_term_points')
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .in('subject_id', subjects.map((subject) => subject.id));
    if (visibilityError) throw new Error(visibilityError.message);
    visibility = (visibilityRows ?? []) as SubjectResultVisibility[];
  }

  const marks = await fetchMarks(assessments.map((item) => item.id));
  return { students, subjects, assessments, marks, visibility };
}
