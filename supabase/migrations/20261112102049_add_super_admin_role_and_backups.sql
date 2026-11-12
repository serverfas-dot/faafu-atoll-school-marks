/*
# Super admin role, scheduled backups, and password resets

1. Purpose
- Introduce a "super_admin" staff role that sits above the existing "admin" role.
- Give super admins exclusive control over staff roles, backups, and restores.
- Add an automatic backup system that snapshots all school data daily and monthly, with download and restore support.

2. Modified Tables
- `public.profiles`
  - The `role` check now allows 'super_admin' in addition to 'admin' and 'teacher'.
- `public.staff_backups` (new)
  - `id` (uuid, primary key) - unique backup identifier.
  - `kind` (text) - 'daily' or 'monthly'.
  - `payload` (jsonb) - full snapshot of students, classes, subjects, assessments, marks, teacher assignments, and staff profiles.
  - `created_by` (uuid, nullable) - profile id when created manually by a super admin.
  - `created_at` (timestamptz) - when the snapshot was taken.

3. Security
- Row level security is enabled on `staff_backups`.
- Only super admins can read, insert, or delete backups; all other roles see nothing.
- A `SECURITY DEFINER` helper `public.is_super_admin()` reads the caller's profile role and is used by the policies, avoiding recursive policy lookups.
- EXECUTE on `is_super_admin()` is granted to `authenticated` and revoked from `anon` and `public`.
- Role changes remain enforced by the `manage-staff` Edge Function, which now requires super admin for role changes.

4. Scheduled backups (pg_cron)
- The extension `pg_cron` is enabled.
- A cron job named `staff-backup-daily` runs `public.create_backup('daily')` at 04:00 UTC every day.
- A cron job named `staff-backup-monthly` runs `public.create_backup('monthly')` at 05:00 UTC on day 1 of each month.
- Existing jobs with the same names are replaced, so applying the migration twice is safe.

5. Important Notes
- No data is deleted or overwritten; `create_backup` only inserts new snapshot rows and prunes monthly backups older than 12 months.
- Restores are performed by a super-admin-only Edge Function that validates the uploaded file before writing.
- Auth account creation, deletion, and password changes stay in the Edge Function so no auth secrets are stored in database tables.
*/

CREATE TABLE IF NOT EXISTS public.staff_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('daily', 'monthly')),
  payload jsonb NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_backups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.staff_backups TO authenticated;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'teacher'::text]));

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DROP POLICY IF EXISTS "super_admin_read_backups" ON public.staff_backups;
CREATE POLICY "super_admin_read_backups" ON public.staff_backups
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_backups" ON public.staff_backups;
CREATE POLICY "super_admin_insert_backups" ON public.staff_backups
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_backups" ON public.staff_backups;
CREATE POLICY "super_admin_delete_backups" ON public.staff_backups
  FOR DELETE TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.create_backup(backup_kind text)
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

REVOKE EXECUTE ON FUNCTION public.create_backup(text) FROM PUBLIC, anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END;
$$;

SELECT cron.unschedule('staff-backup-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'staff-backup-daily');

SELECT cron.unschedule('staff-backup-monthly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'staff-backup-monthly');

SELECT cron.schedule('staff-backup-daily', '0 4 * * *', $$SELECT public.create_backup('daily')$$);
SELECT cron.schedule('staff-backup-monthly', '0 5 1 * *', $$SELECT public.create_backup('monthly')$$);