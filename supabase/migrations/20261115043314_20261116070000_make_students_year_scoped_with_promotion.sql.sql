/*
# Make student rosters school-year specific and add grade promotion

1. Modified Tables
- `public.students`
- New column `school_year` (smallint, NOT NULL, default 2026): the school year this student record belongs to.
- Existing student records are backfilled to 2026 so current marks stay connected to their students.
- The `grade` column is nullable from this migration on, because a student record copied to a new year may need its grade set by the promotion flow.

2. New Table
- `public.student_enrollments` (for history and future-proofing)
- `student_id` references `public.students(id)` on delete cascade.
- `school_year` and `class_name` record where the student was enrolled that year.
- `enrolled_at` timestamps the enrollment.
- A unique rule prevents duplicate enrollment of the same student in the same class and year.
- NOTE: this table records enrollment history for reports; the active roster for each year is the `students` table itself.

3. Security
- Row level security is enabled on `student_enrollments`.
- Signed-in users may read enrollments; only administrators may insert, update, or delete them.
- Grants are limited to the verbs the application uses.

4. Important Notes
- 2026 student records and their marks are unchanged: backfilling does not touch names, rolls, photos, or marks.
- A new year starts with an empty roster; the admin uses "Promote students" to copy a class into the next grade, or adds students manually.
- Marks are tied to assessment rows scoped by school year, so old-year results keep their marks and remain viewable.
*/

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_year smallint NOT NULL DEFAULT 2026;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_school_year_check' AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_school_year_check CHECK (school_year >= 2000 AND school_year <= 2100);
  END IF;
END $$;

UPDATE public.students SET school_year = 2026 WHERE school_year IS NULL;

ALTER TABLE public.students ALTER COLUMN school_year DROP DEFAULT;
ALTER TABLE public.students ALTER COLUMN school_year SET DEFAULT 2026;
ALTER TABLE public.students ALTER COLUMN grade DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year smallint NOT NULL,
  class_name text NOT NULL REFERENCES public.classes(code),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, school_year, class_name)
);

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.student_enrollments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.student_enrollments TO authenticated;

DROP POLICY IF EXISTS "authenticated_select_student_enrollments" ON public.student_enrollments;
CREATE POLICY "authenticated_select_student_enrollments"
ON public.student_enrollments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admin_insert_student_enrollments" ON public.student_enrollments;
CREATE POLICY "admin_insert_student_enrollments"
ON public.student_enrollments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_student_enrollments" ON public.student_enrollments;
CREATE POLICY "admin_update_student_enrollments"
ON public.student_enrollments
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_student_enrollments" ON public.student_enrollments;
CREATE POLICY "admin_delete_student_enrollments"
ON public.student_enrollments
FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS student_enrollments_school_year_idx
ON public.student_enrollments (school_year);