/*
# Add per-subject result column visibility settings

1. New Tables
- `public.subject_result_visibility`
- `subject_id` identifies the grade subject whose result columns are controlled.
- `school_year` and `semester` scope the setting to one academic period.
- `show_unit_points` controls the `30% of Unit Test` column and whether its points count in the final subject percentage.
- `show_term_marks` controls the `2nd Term Marks` input columns.
- `show_term_points` controls the `70% of Term Test` column and whether its points count in the final subject percentage.

2. Security
- Row level security is enabled on the new table.
- Everyone who can use the signed-in marks and reporting screens may read the settings.
- Only administrators and super administrators may insert, update, or delete settings.
- The table is granted only the verbs used by the application.

3. Important Notes
- Existing subjects receive the default behavior: every column is shown and counted.
- Settings are independent for each grade, subject, school year, and semester.
- No assessment rows or saved marks are deleted or changed.
*/

CREATE TABLE IF NOT EXISTS public.subject_result_visibility (
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_year smallint NOT NULL,
  semester smallint NOT NULL CHECK (semester IN (1, 2)),
  show_unit_points boolean NOT NULL DEFAULT true,
  show_term_marks boolean NOT NULL DEFAULT true,
  show_term_points boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, school_year, semester)
);

ALTER TABLE public.subject_result_visibility ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subject_result_visibility TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subject_result_visibility TO authenticated;

DROP POLICY IF EXISTS "public_select_subject_result_visibility" ON public.subject_result_visibility;
CREATE POLICY "public_select_subject_result_visibility"
ON public.subject_result_visibility
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "admin_insert_subject_result_visibility" ON public.subject_result_visibility;
CREATE POLICY "admin_insert_subject_result_visibility"
ON public.subject_result_visibility
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_subject_result_visibility" ON public.subject_result_visibility;
CREATE POLICY "admin_update_subject_result_visibility"
ON public.subject_result_visibility
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_subject_result_visibility" ON public.subject_result_visibility;
CREATE POLICY "admin_delete_subject_result_visibility"
ON public.subject_result_visibility
FOR DELETE
TO authenticated
USING (public.is_admin());