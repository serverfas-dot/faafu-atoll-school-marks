/*
# Allow multiple administrator accounts

1. Purpose
- Teachers can now be promoted to administrators from the signed-in administrator area.
- Existing administrator accounts continue to work without changing any student, subject, assessment, mark, or staff records.

2. Modified Objects
- `public.profiles_single_admin_idx`: removes the previous unique index that limited the database to one administrator profile.

3. Security
- This migration does not grant browser users direct permission to update the `profiles.role` column.
- Role changes remain available only through the existing `manage-staff` Edge Function, which verifies the caller's authenticated session and administrator role before changing a target profile.
- The Edge Function prevents an administrator from removing their own access and prevents the last administrator from being demoted or deleted.

4. Important Notes
- Multiple administrator accounts are now supported.
- The existing first-admin bootstrap flow remains available for a database with no administrator profile.
- No data is deleted and no table columns or row values are changed.
*/

DROP INDEX IF EXISTS public.profiles_single_admin_idx;