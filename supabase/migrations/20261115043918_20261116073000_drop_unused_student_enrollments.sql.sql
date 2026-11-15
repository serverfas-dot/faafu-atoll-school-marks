/*
# Remove unused enrollment history table

1. Modified Tables
- `public.student_enrollments` is dropped.
- It was created earlier in this feature set but is not needed: the `students` table itself is now scoped by `school_year`, so each year's roster rows already record enrollment history.

2. Security
- No policy or grant changes; the table and its policies are removed together.

3. Important Notes
- The table contains no rows; dropping it cannot lose any user data.
- Students, marks, assessments, and results are unchanged.
*/

DROP TABLE IF EXISTS public.student_enrollments;