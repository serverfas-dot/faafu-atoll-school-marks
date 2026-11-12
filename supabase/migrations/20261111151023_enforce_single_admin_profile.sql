/*
# Allow only one admin profile

1. Modified Tables
- `profiles`: adds a unique index so at most one row can have the role 'admin'.

2. Why
- The first-admin setup checks whether an admin exists and then creates one. Two people submitting at the same moment could both create an admin. The database now rejects the second one.

3. Security
- No policy or grant changes.
- Teacher accounts are unaffected; many teacher rows are still allowed.

4. Notes
- Safe to re-run: the index is created only if it does not already exist.
*/

CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_admin_idx
  ON profiles ((role))
  WHERE role = 'admin';
