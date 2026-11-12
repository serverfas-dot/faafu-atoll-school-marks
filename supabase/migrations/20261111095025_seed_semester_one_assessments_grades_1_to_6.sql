/*
# Seed Semester 1 assessments for grades 1 to 6

1. Changes
- Adds "Assessment 1" and "Assessment 2" to every grade 1 to 6 subject for Semester 1.
- Each assessment is out of 25 marks with a weight of 50, matching the Semester 2 sheets.

2. Security
- No table, policy or grant changes.

3. Notes
- Idempotent: existing Semester 1 assessments with the same name are not duplicated.
- Grades 7 to 10 are not touched because their Semester 1 assessment names were not confirmed.
*/

INSERT INTO assessments (subject_id, semester, name, max_mark, weight, sort_order)
SELECT s.id, 1, v.name, 25, 50, v.sort_order
FROM subjects s
CROSS JOIN (VALUES ('Assessment 1', 1), ('Assessment 2', 2)) AS v(name, sort_order)
WHERE s.grade BETWEEN 1 AND 6
  AND NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.subject_id = s.id AND a.semester = 1 AND a.name = v.name
  );
