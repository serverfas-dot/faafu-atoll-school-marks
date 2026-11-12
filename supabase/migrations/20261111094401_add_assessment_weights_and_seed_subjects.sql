/*
# Add assessment weights and seed grade subjects

1. Modified Tables
- `assessments`: new column `weight`, the points (out of 100) an assessment contributes to its subject total when the student gets full marks. Example: grades 1-6 use 50 for each 25-mark assessment.

2. Seeded Data
- Grades 1-6: nine subjects (Quran, Islam, Dhivehi, English, Maths, Science, Social Studies, Creative Arts, Health & PE), each with Assessment 3 and Assessment 4 (25 marks each) for Semester 2.
- Grades 7-10: nine subjects (Quran, Islam, Dhivehi, English, Mathematics, Biology, M.Science, Chemistry, Physics). Quran has unit tests only. The other subjects have unit tests (Assessment 3, Assessment 4, Class Work) plus a Term Test (100 marks, 70 points).
- Semester 1 assessments are not seeded and must be added by an admin.

3. Security
- No security changes. Existing policies still apply.

4. Important Notes
- Seeding uses ON CONFLICT DO NOTHING, so re-running is safe.
- Weights for grades 7-10 are the 30/70 split from the sheet, rounded to two decimals.
*/

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS weight numeric(6, 2) NOT NULL CHECK (weight > 0);

INSERT INTO subjects (name, grade, sort_order)
SELECT s.name, g.grade::smallint, s.ord
FROM generate_series(1, 6) AS g(grade)
CROSS JOIN (VALUES
  ('Quran', 1), ('Islam', 2), ('Dhivehi', 3), ('English', 4), ('Maths', 5),
  ('Science', 6), ('Social Studies', 7), ('Creative Arts', 8), ('Health & PE', 9)
) AS s(name, ord)
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO subjects (name, grade, sort_order)
SELECT s.name, g.grade::smallint, s.ord
FROM generate_series(7, 10) AS g(grade)
CROSS JOIN (VALUES
  ('Quran', 1), ('Islam', 2), ('Dhivehi', 3), ('English', 4), ('Mathematics', 5),
  ('Biology', 6), ('M.Science', 7), ('Chemistry', 8), ('Physics', 9)
) AS s(name, ord)
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO assessments (subject_id, semester, name, max_mark, weight, sort_order)
SELECT sub.id, 2, a.name, 25, 50, a.ord
FROM subjects sub
CROSS JOIN (VALUES ('Assessment 3', 1), ('Assessment 4', 2)) AS a(name, ord)
WHERE sub.grade BETWEEN 1 AND 6
ON CONFLICT (subject_id, semester, name) DO NOTHING;

INSERT INTO assessments (subject_id, semester, name, max_mark, weight, sort_order)
SELECT sub.id, 2, a.name, a.max_mark, a.weight, a.ord
FROM subjects sub
CROSS JOIN (VALUES
  ('Assessment 3', 25, 35.71, 1),
  ('Assessment 4', 25, 35.71, 2),
  ('Class Work', 20, 28.57, 3)
) AS a(name, max_mark, weight, ord)
WHERE sub.grade BETWEEN 7 AND 10 AND sub.name = 'Quran'
ON CONFLICT (subject_id, semester, name) DO NOTHING;

INSERT INTO assessments (subject_id, semester, name, max_mark, weight, sort_order)
SELECT sub.id, 2, a.name, a.max_mark, a.weight, a.ord
FROM subjects sub
CROSS JOIN (VALUES
  ('Assessment 3', 25, 10.71, 1),
  ('Assessment 4', 25, 10.71, 2),
  ('Class Work', 20, 8.57, 3),
  ('Term Test', 100, 70, 4)
) AS a(name, max_mark, weight, ord)
WHERE sub.grade BETWEEN 7 AND 10 AND sub.name <> 'Quran'
ON CONFLICT (subject_id, semester, name) DO NOTHING;
