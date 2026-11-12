/*
# Add admin-controlled mark entry windows

1. Purpose
- Let an administrator set the opening and closing date/time for teacher mark entry for each semester and school year.
- Allow every teacher to enter marks during the active window.
- Prevent teacher mark inserts, edits, and deletes after the window closes, with the rule enforced by the database rather than only by the screen.

2. New Tables
- `public.mark_entry_windows`
  - `id` (uuid, primary key) - unique window identifier.
  - `year` (smallint) - school year for the window.
  - `semester` (smallint) - semester 1 or 2.
  - `opens_at` (timestamptz) - first date/time teachers may save marks.
  - `closes_at` (timestamptz) - final date/time teachers may save marks.
  - `created_at` (timestamptz) - when the window was first created.
  - `updated_at` (timestamptz) - when the window was last changed.
- One window is allowed per year and semester.

3. Modified Functions
- `public.can_enter_marks_for(assessment_id)` now allows:
  - Administrators and super administrators at any time.
  - Any teacher, for any subject, only when the current time is inside the matching year and semester window.
- Existing teacher assignment checks are no longer used to decide whether a teacher can save during an active window; the administrator-controlled window opens mark entry for all teachers as requested.

4. Security
- Row level security is enabled on `mark_entry_windows`.
- Authenticated staff may read window dates so the interface can show whether mark entry is open.
- Only administrators and super administrators may create, change, or remove windows.
- Existing mark table policies continue to call `can_enter_marks_for`, so direct API requests are also blocked after closing time.

5. Important Notes
- No marks, students, subjects, assessments, classes, or staff records are changed.
- A missing window means teacher mark entry is closed.
- Date validation requires the closing time to be after the opening time.
*/

CREATE TABLE IF NOT EXISTS public.mark_entry_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester smallint NOT NULL CHECK (semester IN (1, 2)),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mark_entry_windows_dates_check CHECK (closes_at > opens_at),
  CONSTRAINT mark_entry_windows_year_semester_key UNIQUE (year, semester)
);

ALTER TABLE public.mark_entry_windows ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_entry_windows TO authenticated;

DROP POLICY IF EXISTS "authenticated_read_mark_entry_windows" ON public.mark_entry_windows;
CREATE POLICY "authenticated_read_mark_entry_windows"
ON public.mark_entry_windows
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "admin_insert_mark_entry_windows" ON public.mark_entry_windows;
CREATE POLICY "admin_insert_mark_entry_windows"
ON public.mark_entry_windows
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_mark_entry_windows" ON public.mark_entry_windows;
CREATE POLICY "admin_update_mark_entry_windows"
ON public.mark_entry_windows
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_mark_entry_windows" ON public.mark_entry_windows;
CREATE POLICY "admin_delete_mark_entry_windows"
ON public.mark_entry_windows
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
      JOIN public.mark_entry_windows w
        ON w.year = EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::smallint
       AND w.semester = a.semester
       AND CURRENT_TIMESTAMP >= w.opens_at
       AND CURRENT_TIMESTAMP <= w.closes_at
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'
    );
$$;