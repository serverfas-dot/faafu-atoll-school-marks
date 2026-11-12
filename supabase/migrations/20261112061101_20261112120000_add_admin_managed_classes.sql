/*
# Add admin-managed classes

1. New Tables
- `public.classes`
- `code` (text, primary key): stable code used by students and subjects.
- `label` (text): name shown throughout the app.
- `sheet_kind` (text): `primary` or `secondary`, controlling the marks formula and grade bands.
- `sort_order` (integer): display order in class selectors.
- `created_at` (timestamptz): creation timestamp.

2. Modified Tables
- `public.students.class_name`: now references `classes.code` so classes cannot be removed while students use them.
- `public.subjects.class_name`: now references `classes.code` so classes cannot be removed while subjects use them.
- Existing hard-coded class-name checks are replaced by these references, allowing admins to add new classes.

3. Seed Data
- The twelve existing classes are inserted with their current labels and order.
- Existing class records in students and subjects remain unchanged.

4. Security
- Row-level security is enabled on `classes`.
- Anyone using the app may read class definitions.
- Only signed-in administrators may insert, update, or delete classes.
- Grants are limited to the operations used by the app.

5. Important Notes
- Deleting a class is intentionally blocked by database references while it still has students or subjects, protecting marks and assignments from accidental removal.
- The existing secondary classes keep the secondary 30% plus 70% marks sheet behavior.
*/

CREATE TABLE IF NOT EXISTS public.classes (
  code text PRIMARY KEY CHECK (code ~ '^[A-Za-z0-9_-]+$'),
  label text NOT NULL CHECK (btrim(label) <> ''),
  sheet_kind text NOT NULL DEFAULT 'primary' CHECK (sheet_kind IN ('primary', 'secondary')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.classes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.classes TO authenticated;

DROP POLICY IF EXISTS "public_select_classes" ON public.classes;
CREATE POLICY "public_select_classes"
ON public.classes FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "admin_insert_classes" ON public.classes;
CREATE POLICY "admin_insert_classes"
ON public.classes FOR INSERT
TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_classes" ON public.classes;
CREATE POLICY "admin_update_classes"
ON public.classes FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_classes" ON public.classes;
CREATE POLICY "admin_delete_classes"
ON public.classes FOR DELETE
TO authenticated
USING (is_admin());

INSERT INTO public.classes (code, label, sheet_kind, sort_order)
VALUES
  ('1', 'Grade 1', 'primary', 1),
  ('2', 'Grade 2', 'primary', 2),
  ('3', 'Grade 3', 'primary', 3),
  ('4', 'Grade 4', 'primary', 4),
  ('5', 'Grade 5', 'primary', 5),
  ('6', 'Grade 6', 'primary', 6),
  ('7', 'Grade 7', 'secondary', 7),
  ('8', 'Grade 8', 'secondary', 8),
  ('9BS', 'Grade 9 BS', 'secondary', 9),
  ('9SC', 'Grade 9 SC', 'secondary', 10),
  ('10BS', 'Grade 10 BS', 'secondary', 11),
  ('10SC', 'Grade 10 SC', 'secondary', 12)
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.students'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%class_name%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.students DROP CONSTRAINT %I', constraint_name);
  END IF;

  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.subjects'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%class_name%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.subjects DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.students'::regclass
      AND conname = 'students_class_name_fkey'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_class_name_fkey
      FOREIGN KEY (class_name) REFERENCES public.classes(code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subjects'::regclass
      AND conname = 'subjects_class_name_fkey'
  ) THEN
    ALTER TABLE public.subjects
      ADD CONSTRAINT subjects_class_name_fkey
      FOREIGN KEY (class_name) REFERENCES public.classes(code);
  END IF;
END $$;