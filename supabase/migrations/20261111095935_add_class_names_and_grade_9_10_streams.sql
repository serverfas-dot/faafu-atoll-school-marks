/*
# Add class names, including Grade 9 and 10 streams

1. New Columns
- `students.class_name` and `subjects.class_name` (text). Values are "1" to "8", "9BS", "9SC", "10BS" and "10SC".
- The old numeric `grade` column stays in place but is no longer required, so new rows only need a class name.

2. Data Changes
- Existing rows get their class name from their grade. Grade 9 and 10 subjects become the BS stream.
- The SC stream gets a copy of each Grade 9 and 10 BS subject and its assessments, so the admin can adjust them separately.
- No student, mark or teacher data is changed.

3. Constraints
- Subject names are unique per class (replaces the unique rule on grade and name).
- Class names are limited to the allowed list.

4. Security
- No table, policy or grant changes.

5. Notes
- Copied SC subjects and assessments match the BS seed and should be reviewed by the admin.
- Safe to re-run: existing copies are not duplicated.
*/

ALTER TABLE students ADD COLUMN IF NOT EXISTS class_name text;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS class_name text;

UPDATE students SET class_name = grade::text WHERE class_name IS NULL;

UPDATE subjects
SET class_name = CASE WHEN grade IN (9, 10) THEN grade::text || 'BS' ELSE grade::text END
WHERE class_name IS NULL;

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_grade_name_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_class_name_name_key;
ALTER TABLE subjects ADD CONSTRAINT subjects_class_name_name_key UNIQUE (class_name, name);

INSERT INTO subjects (name, grade, class_name, sort_order)
SELECT old.name, old.grade, replace(old.class_name, 'BS', 'SC'), old.sort_order
FROM subjects old
WHERE old.class_name LIKE '%BS'
ON CONFLICT (class_name, name) DO NOTHING;

INSERT INTO assessments (subject_id, semester, name, max_mark, weight, sort_order)
SELECT new_subject.id, a.semester, a.name, a.max_mark, a.weight, a.sort_order
FROM assessments a
JOIN subjects old_subject ON old_subject.id = a.subject_id
JOIN subjects new_subject
  ON new_subject.class_name = replace(old_subject.class_name, 'BS', 'SC')
 AND new_subject.name = old_subject.name
WHERE old_subject.class_name LIKE '%BS'
ON CONFLICT (subject_id, semester, name) DO NOTHING;

UPDATE students SET class_name = grade::text WHERE class_name IS NULL;

ALTER TABLE students ALTER COLUMN class_name SET NOT NULL;
ALTER TABLE subjects ALTER COLUMN class_name SET NOT NULL;

ALTER TABLE students ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE subjects ALTER COLUMN grade DROP NOT NULL;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_name_check;
ALTER TABLE students ADD CONSTRAINT students_class_name_check
  CHECK (class_name IN ('1','2','3','4','5','6','7','8','9BS','9SC','10BS','10SC'));

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_class_name_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_class_name_check
  CHECK (class_name IN ('1','2','3','4','5','6','7','8','9BS','9SC','10BS','10SC'));
