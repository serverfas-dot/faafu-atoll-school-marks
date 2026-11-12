/*
# Allow super admins to use all admin areas

1. Purpose
- Make the new `super_admin` role behave as an administrator everywhere the existing app checks for admin access.
- Restore visibility of all staff profiles and teacher subject assignments for the super admin dashboard.

2. Modified Functions
- `public.is_admin()` now returns true for both `admin` and `super_admin` profiles.

3. Security
- Existing authenticated-only policies remain unchanged.
- No anonymous access is added.
- Super admins receive the same school-management access as admins, while the separate super-admin-only controls remain protected by `public.is_super_admin()` and the Edge Functions.

4. Important Notes
- No student, subject, mark, class, staff, or assignment records are changed.
- This migration only corrects role recognition in existing access checks.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;