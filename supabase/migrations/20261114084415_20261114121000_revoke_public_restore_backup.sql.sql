/*
# Restrict backup restore execution

1. Security
- Remove anonymous and public EXECUTE permission from `public.restore_backup(jsonb)`.
- Keep restore available only to signed-in users; the function itself continues to require the super-admin role.

2. Important Notes
- This closes an exposed remote-callable SECURITY DEFINER function without changing stored backup data or the restore workflow.
*/

REVOKE EXECUTE ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
