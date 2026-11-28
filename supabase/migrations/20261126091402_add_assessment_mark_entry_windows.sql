/*
# Add assessment-specific teacher mark entry windows

1. Purpose
- Replace the semester-wide teacher editing window with precise windows for each assessment.
- Allow an administrator to open Assessment 1, Assessment 2, Class Work, Term Test, or any other configured assessment independently.
- Keep teachers able to view marks outside an open window while preventing mark inserts, edits, and deletes.

2. New Tables
- `public.assessment_mark_entry_windows`
  - `id` (uuid, primary key) - unique schedule identifier.
  - `assessment_id` (uuid) - the exact assessment that teachers may enter.
  - `year` (smallint) - school year for the schedule.
  - `semester` (smallint) - semester 1 or 2 for the schedule.
  - `opens_at` (timestamptz) - first time teachers may save marks for the assessment.
  - `closes_at` (timestamptz) - final time teachers may save marks for the assessment.
  - `created_at` (timestamptz) - when the schedule was created.
  - `updated_at` (timestamptz) - when the schedule was last changed.
- One schedule is allowed for each exact assessment.

3. Modified Functions
- `public.can_enter_marks_for(assessment_id)` now checks the exact assessment schedule, its school year, its semester, and the existing teacher-to-subject assignment.
- Administrators and super administrators retain access at any time.
- Existing semester-level windows remain stored and continue as a compatibility fallback only until an assessment-specific schedule is created for that semester and school year. Once the new system is configured for that semester, only individually scheduled assessments can be edited.

4. Security
- Row level security is enabled on the new table.
- Authenticated staff may read schedules so the interface can show which assessments are open.
- Only administrators and super administrators may create, change, or remove schedules.
- Existing mark table policies continue to call `can_enter_marks_for`, so direct API requests cannot bypass the assessment-level time limit.

5. Important Notes
- No students, marks, assessments, subjects, teachers, or existing semester-window rows are deleted or changed.
- A missing assessment-specific schedule is closed after that semester has been configured with the new system.
- Opening and closing times must be valid, with closing after opening.
*/

CREATE TABLE IF NOT EXISTS public.assessment_mark_entry_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester smallint NOT NULL CHECK (semester IN (1, 2)),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_mark_entry_windows_dates_check CHECK (closes_at > opens_at),
  CONSTRAINT assessment_mark_entry_windows_assessment_key UNIQUE (assessment_id)
);

ALTER TABLE public.assessment_mark_entry_windows ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_mark_entry_windows TO authenticated;

DROP POLICY IF EXISTS "authenticated_read_assessment_mark_entry_windows" ON public.assessment_mark_entry_windows;
CREATE POLICY "authenticated_read_assessment_mark_entry_windows"
ON public.assessment_mark_entry_windows
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "admin_insert_assessment_mark_entry_windows" ON public.assessment_mark_entry_windows;
CREATE POLICY "admin_insert_assessment_mark_entry_windows"
ON public.assessment_mark_entry_windows
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_assessment_mark_entry_windows" ON public.assessment_mark_entry_windows;
CREATE POLICY "admin_update_assessment_mark_entry_windows"
ON public.assessment_mark_entry_windows
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_assessment_mark_entry_windows" ON public.assessment_mark_entry_windows;
CREATE POLICY "admin_delete_assessment_mark_entry_windows"
ON public.assessment_mark_entry_windows
FOR DELETE TO authenticated
USING (public.is_admin());

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
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'
        AND (
          EXISTS (
            SELECT 1
            FROM public.assessment_mark_entry_windows aw
            WHERE aw.assessment_id = a.id
              AND aw.year = a.school_year
              AND aw.semester = a.semester
              AND CURRENT_TIMESTAMP >= aw.opens_at
              AND CURRENT_TIMESTAMP <= aw.closes_at
          )
          OR (
            NOT EXISTS (
              SELECT 1
              FROM public.assessment_mark_entry_windows configured
              WHERE configured.year = a.school_year
                AND configured.semester = a.semester
            )
            AND EXISTS (
              SELECT 1
              FROM public.mark_entry_windows legacy
              WHERE legacy.year = a.school_year
                AND legacy.semester = a.semester
                AND CURRENT_TIMESTAMP >= legacy.opens_at
                AND CURRENT_TIMESTAMP <= legacy.closes_at
            )
          )
        )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_enter_marks_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_enter_marks_for(uuid) TO authenticated;