/*
# Add secure student photo support

1. Modified Tables
- `public.students.photo_url` (text, nullable): public image URL displayed on student reports and student lists.
- Existing student names, roll numbers, class assignments, and marks are unchanged.

2. Storage
- Creates the public `student-photos` bucket for school report images.
- Limits uploaded files to 5 MB and allows only JPEG, PNG, and WebP images.
- Photos are stored under a student UUID folder so each file belongs to a known student record.

3. Security
- Only authenticated administrators may upload, replace, or delete files in `student-photos`.
- Public report pages may display the images through the bucket's public URLs.
- Storage policies validate the bucket, student folder, and administrator role on every write.

4. Important Notes
- This migration adds only a nullable photo reference and does not remove or rewrite existing student data.
- The browser's file picker is only a convenience; the storage bucket settings enforce the allowed file types and size limit.
*/

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

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