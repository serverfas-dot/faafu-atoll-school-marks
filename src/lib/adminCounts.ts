import { supabase } from '@/lib/supabase';

export async function countMarks(filter: { studentId?: string; assessmentId?: string; subjectId?: string; schoolYear?: number }): Promise<number> {
  let assessmentIds: string[] | null = null;
  if (filter.subjectId) {
    const { data, error } = await supabase.from('assessments').select('id').eq('subject_id', filter.subjectId);
    if (error) throw new Error(error.message);
    let subjectAssessments = (data ?? []).map((row) => row.id as string);
    if (filter.schoolYear !== undefined && subjectAssessments.length > 0) {
      const { data: yearRows, error: yearError } = await supabase
        .from('assessments')
        .select('id')
        .in('id', subjectAssessments)
        .eq('school_year', filter.schoolYear);
      if (yearError) throw new Error(yearError.message);
      subjectAssessments = (yearRows ?? []).map((row) => row.id as string);
    }
    assessmentIds = subjectAssessments;
    if (assessmentIds.length === 0) return 0;
  }

  let query = supabase.from('marks').select('id', { count: 'exact', head: true });
  if (filter.studentId) query = query.eq('student_id', filter.studentId);
  if (filter.assessmentId) query = query.eq('assessment_id', filter.assessmentId);
  if (assessmentIds) query = query.in('assessment_id', assessmentIds);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
