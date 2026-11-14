/*
# Add school-year management and year-specific assessments

1. New Tables
- `public.school_years`
  - `year` (smallint, primary key) - the school year shown in selectors.
  - `is_active` (boolean) - whether the year is available in normal marks, results, and report selectors.
  - `created_at` and `updated_at` (timestamptz) - management timestamps.

2. Modified Tables
- `public.assessments`
  - Add `school_year` (smallint, default 2026) so assessment records and their marks belong to one school year.
  - Replace the old assessment uniqueness rule with one that includes the school year.
- `public.mark_entry_windows`
  - Existing year and semester records are included in backups and follow renamed school years.

3. Functions
- Add administrator-only functions to create, rename, and archive/reactivate school years.
- Creating a year copies the assessment setup from the latest active year but does not copy marks.
- Update backup and restore functions so school years, assessment years, and mark-entry windows survive backups.

4. Security
- Enable RLS on `school_years`.
- Allow everyone to read the year list, while administrator checks protect direct management policies.
- Only authenticated administrators may execute year-management functions.
- Keep function search paths fixed and revoke public/anonymous execution of management functions.

5. Important Notes
- Existing assessment rows are assigned to 2026 without changing their IDs or marks.
- Archiving hides a year from normal selectors instead of deleting it, so historical records remain safe.
- Older backup files without school-year fields continue to restore as 2026 data.
*/

CREATE TABLE IF NOT EXISTS public.school_years (
  year smallint PRIMARY KEY CHECK (year >= 2000 AND year <= 2100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.school_years (year, is_active)
VALUES (2026, true)
ON CONFLICT (year) DO NOTHING;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS school_year smallint;

UPDATE public.assessments
SET school_year = 2026
WHERE school_year IS NULL;

ALTER TABLE public.assessments
  ALTER COLUMN school_year SET DEFAULT 2026,
  ALTER COLUMN school_year SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assessments_school_year_check'
      AND conrelid = 'public.assessments'::regclass
  ) THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_school_year_check CHECK (school_year >= 2000 AND school_year <= 2100);
  END IF;
END $$;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_subject_id_semester_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assessments_subject_year_semester_name_key'
      AND conrelid = 'public.assessments'::regclass
  ) THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_subject_year_semester_name_key UNIQUE (subject_id, school_year, semester, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assessments_school_year_subject_idx
  ON public.assessments (school_year, subject_id, semester);

ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.school_years TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view school years" ON public.school_years;
CREATE POLICY "Anyone can view school years"
ON public.school_years FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert school years" ON public.school_years;
CREATE POLICY "Admins can insert school years"
ON public.school_years FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update school years" ON public.school_years;
CREATE POLICY "Admins can update school years"
ON public.school_years FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete school years" ON public.school_years;
CREATE POLICY "Admins can delete school years"
ON public.school_years FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_school_year(target_year smallint, copy_from_year smallint DEFAULT NULL)
RETURNS public.school_years
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_year smallint;
  created_year public.school_years;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can manage school years.';
  END IF;

  IF target_year < 2000 OR target_year > 2100 THEN
    RAISE EXCEPTION 'School year must be between 2000 and 2100.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.school_years WHERE year = target_year) THEN
    RAISE EXCEPTION 'That school year already exists.';
  END IF;

  source_year := COALESCE(
    copy_from_year,
    (SELECT max(year) FROM public.school_years WHERE is_active)
  );

  INSERT INTO public.school_years (year, is_active)
  VALUES (target_year, true)
  RETURNING * INTO created_year;

  IF source_year IS NOT NULL THEN
    INSERT INTO public.assessments (
      subject_id,
      school_year,
      semester,
      name,
      max_mark,
      sort_order,
      created_at,
      weight,
      part
    )
    SELECT
      subject_id,
      target_year,
      semester,
      name,
      max_mark,
      sort_order,
      now(),
      weight,
      part
    FROM public.assessments
    WHERE school_year = source_year
    ON CONFLICT (subject_id, school_year, semester, name) DO NOTHING;
  END IF;

  RETURN created_year;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_school_year(old_year smallint, new_year smallint)
RETURNS public.school_years
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  renamed_year public.school_years;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can manage school years.';
  END IF;

  IF new_year < 2000 OR new_year > 2100 THEN
    RAISE EXCEPTION 'School year must be between 2000 and 2100.';
  END IF;

  IF old_year = new_year THEN
    SELECT * INTO renamed_year FROM public.school_years WHERE year = old_year;
    IF renamed_year.year IS NULL THEN
      RAISE EXCEPTION 'That school year does not exist.';
    END IF;
    RETURN renamed_year;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.school_years WHERE year = old_year) THEN
    RAISE EXCEPTION 'That school year does not exist.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.school_years WHERE year = new_year) THEN
    RAISE EXCEPTION 'The new school year already exists.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.mark_entry_windows WHERE year = new_year) THEN
    RAISE EXCEPTION 'The new school year is already used by mark-entry windows.';
  END IF;

  UPDATE public.assessments SET school_year = new_year WHERE school_year = old_year;
  UPDATE public.mark_entry_windows SET year = new_year WHERE year = old_year;
  UPDATE public.school_years SET year = new_year, updated_at = now() WHERE year = old_year
  RETURNING * INTO renamed_year;

  RETURN renamed_year;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_school_year_active(target_year smallint, active boolean)
RETURNS public.school_years
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_year public.school_years;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can manage school years.';
  END IF;

  UPDATE public.school_years
  SET is_active = active, updated_at = now()
  WHERE year = target_year
  RETURNING * INTO updated_year;

  IF updated_year.year IS NULL THEN
    RAISE EXCEPTION 'That school year does not exist.';
  END IF;

  RETURN updated_year;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_school_year(smallint, smallint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rename_school_year(smallint, smallint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_school_year_active(smallint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_school_year(smallint, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_school_year(smallint, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_school_year_active(smallint, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_backup_internal(backup_kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF backup_kind NOT IN ('daily', 'monthly') THEN
    RAISE EXCEPTION 'Invalid backup kind';
  END IF;

  INSERT INTO public.staff_backups (kind, payload)
  VALUES (
    backup_kind,
    jsonb_build_object(
      'school_years', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.school_years ORDER BY year) t),
      'mark_entry_windows', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.mark_entry_windows ORDER BY year, semester) t),
      'classes', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.classes ORDER BY sort_order) t),
      'students', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.students ORDER BY created_at, id) t),
      'subjects', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.subjects ORDER BY created_at, id) t),
      'assessments', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.assessments ORDER BY school_year, created_at, id) t),
      'marks', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.marks ORDER BY updated_at, id) t),
      'teacher_subjects', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.teacher_subjects) t),
      'profiles', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role, 'created_at', p.created_at)), '[]'::jsonb) FROM public.profiles p)
    )
  )
  RETURNING id INTO new_id;

  DELETE FROM public.staff_backups
  WHERE kind = 'monthly'
    AND created_at < now() - interval '12 months';

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_backup(restore_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  profile_row jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can restore backups.';
  END IF;

  IF restore_payload IS NULL
    OR jsonb_typeof(restore_payload) <> 'object'
    OR NOT (
      restore_payload ? 'classes' AND restore_payload ? 'students'
      AND restore_payload ? 'subjects' AND restore_payload ? 'assessments'
      AND restore_payload ? 'marks' AND restore_payload ? 'teacher_subjects'
      AND restore_payload ? 'profiles'
    ) THEN
    RAISE EXCEPTION 'This file is not a valid backup.';
  END IF;

  PERFORM public.create_backup_internal('daily');

  DELETE FROM public.marks;
  DELETE FROM public.mark_entry_windows;
  DELETE FROM public.teacher_subjects;
  DELETE FROM public.assessments;
  DELETE FROM public.school_years;
  DELETE FROM public.subjects;
  DELETE FROM public.students;
  DELETE FROM public.classes;

  INSERT INTO public.school_years (year, is_active, created_at, updated_at)
  SELECT
    COALESCE((b->>'year')::smallint, 2026),
    COALESCE((b->>'is_active')::boolean, true),
    COALESCE((b->>'created_at')::timestamptz, now()),
    COALESCE((b->>'updated_at')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(restore_payload->'school_years', '[]'::jsonb)) b
  ON CONFLICT (year) DO NOTHING;

  INSERT INTO public.school_years (year, is_active)
  VALUES (2026, true)
  ON CONFLICT (year) DO NOTHING;

  INSERT INTO public.classes (code, label, sheet_kind, sort_order, created_at)
  SELECT
    COALESCE(b->>'code', ''),
    COALESCE(b->>'label', ''),
    COALESCE(b->>'sheet_kind', 'primary'),
    COALESCE((b->>'sort_order')::int, 0),
    COALESCE((b->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(restore_payload->'classes') b;

  INSERT INTO public.students (id, full_name, grade, roll_no, class_name, photo_url, created_at)
  SELECT
    (b->>'id')::uuid,
    COALESCE(b->>'full_name', ''),
    (NULLIF(b->>'grade', ''))::smallint,
    COALESCE(b->>'roll_no', ''),
    COALESCE(b->>'class_name', ''),
    b->>'photo_url',
    COALESCE((b->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(restore_payload->'students') b;

  INSERT INTO public.subjects (id, name, grade, sort_order, created_at, class_name)
  SELECT
    (b->>'id')::uuid,
    COALESCE(b->>'name', ''),
    (NULLIF(b->>'grade', ''))::smallint,
    COALESCE((b->>'sort_order')::int, 0),
    COALESCE((b->>'created_at')::timestamptz, now()),
    COALESCE(b->>'class_name', '')
  FROM jsonb_array_elements(restore_payload->'subjects') b;

  INSERT INTO public.assessments (id, subject_id, school_year, semester, name, max_mark, sort_order, created_at, weight, part)
  SELECT
    (b->>'id')::uuid,
    (b->>'subject_id')::uuid,
    COALESCE((NULLIF(b->>'school_year', ''))::smallint, 2026),
    COALESCE((b->>'semester')::smallint, 1),
    COALESCE(b->>'name', ''),
    COALESCE((b->>'max_mark')::numeric, 0),
    COALESCE((b->>'sort_order')::int, 0),
    COALESCE((b->>'created_at')::timestamptz, now()),
    COALESCE((b->>'weight')::numeric, 0),
    COALESCE(b->>'part', 'unit')
  FROM jsonb_array_elements(restore_payload->'assessments') b;

  INSERT INTO public.mark_entry_windows (id, year, semester, opens_at, closes_at, created_at, updated_at)
  SELECT
    (b->>'id')::uuid,
    COALESCE((b->>'year')::smallint, 2026),
    COALESCE((b->>'semester')::smallint, 1),
    (b->>'opens_at')::timestamptz,
    (b->>'closes_at')::timestamptz,
    COALESCE((b->>'created_at')::timestamptz, now()),
    COALESCE((b->>'updated_at')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(restore_payload->'mark_entry_windows', '[]'::jsonb)) b;

  INSERT INTO public.teacher_subjects (teacher_id, subject_id)
  SELECT (b->>'teacher_id')::uuid, (b->>'subject_id')::uuid
  FROM jsonb_array_elements(restore_payload->'teacher_subjects') b;

  INSERT INTO public.marks (id, student_id, assessment_id, mark, updated_at)
  SELECT
    (b->>'id')::uuid,
    (b->>'student_id')::uuid,
    (b->>'assessment_id')::uuid,
    COALESCE((b->>'mark')::numeric, 0),
    COALESCE((b->>'updated_at')::timestamptz, now())
  FROM jsonb_array_elements(restore_payload->'marks') b;

  FOR profile_row IN SELECT * FROM jsonb_array_elements(restore_payload->'profiles') LOOP
    IF profile_row->>'role' IN ('super_admin', 'admin', 'teacher') THEN
      IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (profile_row->>'id')::uuid) THEN
        UPDATE public.profiles
        SET full_name = COALESCE(profile_row->>'full_name', full_name),
            email = COALESCE(profile_row->>'email', email),
            role = profile_row->>'role'
        WHERE id = (profile_row->>'id')::uuid;
      ELSIF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (profile_row->>'id')::uuid) THEN
        INSERT INTO public.profiles (id, full_name, email, role)
        VALUES (
          (profile_row->>'id')::uuid,
          COALESCE(profile_row->>'full_name', ''),
          COALESCE(profile_row->>'email', ''),
          profile_row->>'role'
        );
      END IF;
    END IF;
  END LOOP;

  UPDATE public.profiles SET role = 'super_admin' WHERE id = caller;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;

SELECT cron.unschedule('staff-backup-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'staff-backup-daily');

SELECT cron.unschedule('staff-backup-monthly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'staff-backup-monthly');

SELECT cron.schedule('staff-backup-daily', '0 4 * * *', $$SELECT public.create_backup_internal('daily')$$);
SELECT cron.schedule('staff-backup-monthly', '0 5 1 * *', $$SELECT public.create_backup_internal('monthly')$$);
