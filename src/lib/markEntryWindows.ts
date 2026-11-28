import { MARKS_SHEET_YEAR } from '@/lib/school';
import { supabase } from '@/lib/supabase';

export type AssessmentMarkEntryWindow = {
  id: string;
  assessment_id: string;
  year: number;
  semester: 1 | 2;
  opens_at: string;
  closes_at: string;
  created_at: string;
  updated_at: string;
};

export async function listAssessmentMarkEntryWindows(year = MARKS_SHEET_YEAR): Promise<AssessmentMarkEntryWindow[]> {
  const { data, error } = await supabase
    .from('assessment_mark_entry_windows')
    .select('id, assessment_id, year, semester, opens_at, closes_at, created_at, updated_at')
    .eq('year', year)
    .order('semester')
    .order('opens_at');
  if (error) throw new Error('Could not load assessment mark entry windows.');
  return (data ?? []) as AssessmentMarkEntryWindow[];
}

export async function saveAssessmentMarkEntryWindow(
  assessmentId: string,
  year: number,
  semester: 1 | 2,
  opensAt: string,
  closesAt: string,
): Promise<void> {
  const openDate = new Date(opensAt);
  const closeDate = new Date(closesAt);
  if (!Number.isFinite(openDate.getTime()) || !Number.isFinite(closeDate.getTime()) || closeDate <= openDate) {
    throw new Error('Choose a valid opening time before the closing time.');
  }
  const { error } = await supabase.from('assessment_mark_entry_windows').upsert(
    {
      assessment_id: assessmentId,
      year,
      semester,
      opens_at: openDate.toISOString(),
      closes_at: closeDate.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'assessment_id' },
  );
  if (error) throw new Error('Could not save the assessment mark entry window.');
}

export async function removeAssessmentMarkEntryWindow(assessmentId: string): Promise<void> {
  const { error } = await supabase
    .from('assessment_mark_entry_windows')
    .delete()
    .eq('assessment_id', assessmentId);
  if (error) throw new Error('Could not close the assessment mark entry window.');
}

export function isMarkEntryWindowOpen(window: AssessmentMarkEntryWindow | null, now = new Date()): boolean {
  if (!window) return false;
  const opensAt = new Date(window.opens_at).getTime();
  const closesAt = new Date(window.closes_at).getTime();
  const current = now.getTime();
  return Number.isFinite(opensAt) && Number.isFinite(closesAt) && current >= opensAt && current <= closesAt;
}

export function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function formatWindowDate(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
