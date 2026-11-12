/*
# Restrict class write privileges

1. Modified Tables
- `public.classes`: anonymous users retain read access, while insert, update, and delete privileges are removed.

2. Security
- Anonymous users can read class options needed by the app.
- Only authenticated users with the administrator role retain class write privileges.
- Row-level policies remain the final authorization check for all class changes.

3. Important Notes
- This migration does not change any class records or remove any data.
- It aligns table grants with the existing administrator-only policies.
*/

REVOKE INSERT, UPDATE, DELETE ON public.classes FROM anon;
GRANT SELECT ON public.classes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;