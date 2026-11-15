/*
# Add AB (absent) to mark absence types

1. Modified Tables
- `public.marks`
- The `absence_type` check rule now allows 'AB' (absent) in addition to 'MC' (medical leave) and 'OL' (official leave).

2. Security
- No policy changes.

3. Important Notes
- The application treats AB like MC/OL: the paper is exempt from that student's earned marks and out-of total.
- Existing marks are unchanged.
*/

ALTER TABLE public.marks DROP CONSTRAINT IF EXISTS marks_absence_type_check;

ALTER TABLE public.marks
  ADD CONSTRAINT marks_absence_type_check CHECK (absence_type IN ('MC', 'OL', 'AB'));