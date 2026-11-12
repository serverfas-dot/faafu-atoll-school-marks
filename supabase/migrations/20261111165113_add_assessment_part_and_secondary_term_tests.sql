ALTER TABLE assessments ADD COLUMN part text NOT NULL DEFAULT 'unit' CHECK (part IN ('unit', 'term'));

UPDATE assessments a
SET part = 'term'
FROM subjects s
WHERE s.id = a.subject_id
  AND s.class_name IN ('7', '8', '9BS', '9SC', '10BS', '10SC')
  AND a.name = 'Term Test';

INSERT INTO assessments (subject_id, semester, name, max_mark, weight, part, sort_order)
SELECT s.id, 2, 'Term Test', 100, 70, 'term', 4
FROM subjects s
WHERE s.name = 'Quran'
  AND s.class_name IN ('7', '8', '9BS', '9SC', '10BS', '10SC')
  AND NOT EXISTS (
    SELECT 1 FROM assessments x WHERE x.subject_id = s.id AND x.semester = 2 AND x.name = 'Term Test'
  );

UPDATE assessments a
SET weight = 30 * a.max_mark / 70
FROM subjects s
WHERE s.id = a.subject_id
  AND s.class_name IN ('7', '8', '9BS', '9SC', '10BS', '10SC')
  AND a.semester = 2
  AND a.part = 'unit';
