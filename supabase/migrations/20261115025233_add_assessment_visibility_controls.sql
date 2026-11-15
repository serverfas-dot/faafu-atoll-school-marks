/*
# Add assessment visibility controls

1. Modified Tables
- `public.assessments`
- Add `is_active` (boolean, not null, default true) to control whether an assessment participates in the normal marks workflow.
- Existing assessments remain active so current marks and reports do not change unexpectedly.

2. Application Behavior
- Active assessments continue to appear in marks entry, results, reports, and percentage calculations.
- Administrators can hide an assessment without deleting it or deleting its saved marks.
- Hidden assessments remain available in the admin assessment manager so they can be restored later.

3. Security
- Keep the existing administrator-only INSERT, UPDATE, and DELETE policies on `public.assessments`.
- The new field is changed only through the existing authenticated administrator update path.
- Public and authenticated users may continue to read assessment definitions, while only administrators can change them.

4. Important Notes
- This migration is non-destructive and preserves all existing assessment rows and marks.
- The default keeps every existing assessment active.
- The frontend must filter inactive assessments before calculating totals or displaying normal marks-entry and report views.
*/

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.assessments
SET is_active = true
WHERE is_active IS NULL;