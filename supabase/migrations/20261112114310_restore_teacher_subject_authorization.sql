/*
# Restore teacher subject authorization during open windows

1. Purpose
- Keep the administrator-controlled mark-entry dates.
- Ensure a teacher may enter marks only for subjects explicitly assigned to that teacher by an administrator.
- Keep administrators and super administrators able to manage all subjects at any time.

2. Modified Functions
- `public.can_enter_marks_for(assessment_id)` now requires both:
  1. An active mark-entry window for the assessment semester and current year.
  2. A matching `teacher_subjects` assignment connecting the signed-in teacher to the assessment subject.

3. Security
- Direct database requests cannot bypass the teacher’s subject assignment by calling the marks API directly.
- Existing administrator access remains unchanged.
- No table rows or assignments are changed.

4. Important Notes
- Teachers will see only the subjects assigned to them in the Marks entry screen.
- The open window controls when an authorized teacher may save; it does not grant new subject permissions.
- A teacher with no assignment for a class will see the existing no-assigned-subject message.
*/

CREATE OR REPLACE FUNCTION public.can_enter_marks_for(p_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.assessments a ON a.id = p_assessment_id
      JOIN public.teacher_subjects ts
        ON ts.teacher_id = p.id
       AND ts.subject_id = a.subject_id
      JOIN public.mark_entry_windows w
        ON w.year = EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::smallint
       AND w.semester = a.semester
       AND CURRENT_TIMESTAMP >= w.opens_at
       AND CURRENT_TIMESTAMP <= w.closes_at
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'
    );
$$;