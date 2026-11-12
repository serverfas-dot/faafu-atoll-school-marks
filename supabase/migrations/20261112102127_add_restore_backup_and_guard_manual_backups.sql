/*
# Restore backups and protect manual backup creation

1. Purpose
- Add a super-admin-only restore that rebuilds school data from a downloaded backup file in one atomic operation.
- Restrict manual backup creation to super admins while keeping the scheduled (cron) backups running unattended.

2. New Functions
- `public.create_backup_internal(kind text)` - the original snapshot logic (classes, students, subjects, assessments, marks, teacher assignments, and staff profiles). Only the scheduler and the wrapper below call it.
- `public.create_backup(kind text)` - super-admin-only wrapper for manual "back up now" from the app. The previous unrestricted definition is replaced.
- `public.restore_backup(payload jsonb)` - validates the uploaded backup, takes a safety snapshot of the current data, then replaces classes, students, subjects, assessments, marks, teacher assignments, and staff profile details with the backup contents. Profiles are only updated or inserted when the matching sign-in account exists, and the super admin performing the restore always keeps super admin access.

3. Security
- `create_backup` and `restore_backup` both verify `is_super_admin()` internally and are granted only to `authenticated`.
- `create_backup_internal` is revoked from every role except the scheduler.
- Restore runs as a single database statement, so a failure mid-way rolls the whole restore back; a safety "daily" backup is written first.
- No browser user gains direct write access to any school table through this migration.

4. Important Notes
- Restore deletes current marks, assignments, assessments, subjects, students, and classes before writing the backup contents; the pre-restore safety snapshot protects against mistakes.
- Scheduled jobs are re-pointed to the internal function so daily and monthly backups continue at 04:00 UTC daily and 05:00 UTC on the first day of each month.
*/

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
      'classes', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.classes ORDER BY sort_order) t),
      'students', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.students ORDER BY created_at, id) t),
      'subjects', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.subjects ORDER BY created_at, id) t),
      'assessments', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (SELECT * FROM public.assessments ORDER BY created_at, id) t),
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

REVOKE EXECUTE ON FUNCTION public.create_backup_internal(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_backup(backup_kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can create backups.';
  END IF;
  RETURN public.create_backup_internal(backup_kind);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_backup(text) TO authenticated;

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
  DELETE FROM public.teacher_subjects;
  DELETE FROM public.assessments;
  DELETE FROM public.subjects;
  DELETE FROM public.students;
  DELETE FROM public.classes;

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

  INSERT INTO public.assessments (id, subject_id, semester, name, max_mark, sort_order, created_at, weight, part)
  SELECT
    (b->>'id')::uuid,
    (b->>'subject_id')::uuid,
    COALESCE((b->>'semester')::smallint, 1),
    COALESCE(b->>'name', ''),
    COALESCE((b->>'max_mark')::numeric, 0),
    COALESCE((b->>'sort_order')::int, 0),
    COALESCE((b->>'created_at')::timestamptz, now()),
    COALESCE((b->>'weight')::numeric, 0),
    COALESCE(b->>'part', 'unit')
  FROM jsonb_array_elements(restore_payload->'assessments') b;

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