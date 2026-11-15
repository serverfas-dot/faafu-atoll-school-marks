/*
# Support MC (medical) and OL (official leave) exemptions on marks

1. Modified Tables
- `public.marks`
- New column `absence_type` (text, nullable): NULL for a normal mark, 'MC' for medical leave, 'OL' for official leave.
- A check rule allows only NULL, 'MC', or 'OL'.
- An MC or OL row records that the student did not sit the paper; the mark value is stored as 0 so the existing NOT NULL rule keeps working.

2. Security
- No policy changes: existing marks policies continue to apply unchanged.

3. Important Notes
- The application treats an MC/OL row as an exemption: that paper is excluded from the student's earned marks AND from their out-of total, so the remaining assessments rescale (for example, an assessment worth 30 points out of 70 excluded leaves the student counted out of 40).
- Existing marks are untouched; absence_type is NULL for all of them.
*/

ALTER TABLE public.marks
  ADD COLUMN IF NOT EXISTS absence_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marks_absence_type_check' AND conrelid = 'public.marks'::regclass
  ) THEN
    ALTER TABLE public.marks
      ADD CONSTRAINT marks_absence_type_check CHECK (absence_type IN ('MC', 'OL'));
  END IF;
END $$;