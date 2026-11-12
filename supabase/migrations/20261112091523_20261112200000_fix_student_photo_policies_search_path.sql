/*
# Fix student photo upload policies

1. Purpose
- Fixes student photo uploads failing with "new row violates row-level security policy".
- The file-storage service evaluates storage policies in a session whose search scope does not include the public schema, so references to `students` and `is_admin()` without the `public.` prefix failed to resolve and every admin upload was rejected.

2. Modified Objects
- Storage policies on `storage.objects` for the `student-photos` bucket:
  - `admin_insert_student_photos` (INSERT)
  - `admin_update_student_photos` (UPDATE)
  - `admin_delete_student_photos` (DELETE)
- Each policy now references `public.students` and `public.is_admin()` with explicit schema names.

3. Security
- No access is widened or removed. The same administrator-only checks apply: the caller must be signed in, the file must be inside a folder named after an existing student, and the caller's profile must have the administrator role.
- Anonymous users still have no write access to the bucket.

4. Important Notes
- No student rows, photo records, or stored files are changed.
- Safe to re-run: policies are dropped and recreated with the same names.
*/

DROP POLICY IF EXISTS "admin_insert_student_photos" ON storage.objects;
CREATE POLICY "admin_insert_student_photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.students)
  AND public.is_admin()
);

DROP POLICY IF EXISTS "admin_update_student_photos" ON storage.objects;
CREATE POLICY "admin_update_student_photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.students)
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.students)
  AND public.is_admin()
);

DROP POLICY IF EXISTS "admin_delete_student_photos" ON storage.objects;
CREATE POLICY "admin_delete_student_photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.students)
  AND public.is_admin()
);