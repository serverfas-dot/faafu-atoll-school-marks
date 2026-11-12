import { MARKS_SHEET_YEAR } from '@/lib/school';
import { supabase } from '@/lib/supabase';

export type SemesterValue = 1 | 2;

export type MarkEntryWindow = {
  id: string;
  year: number;
  semester: SemesterValue;
  opens_at: string;
  closes_at: string;
  created_at: string;
  updated_at: string;
};

export async function listMarkEntryWindows(year = MARKS_SHEET_YEAR): Promise<MarkEntryWindow[]> {
  const { data, error } = await supabase
    .from('mark_entry_windows')
    .select('id, year, semester, opens_at, closes_at, created_at, updated_at')
    .eq('year', year)
    .order('semester');
  if (error) throw new Error('Could not load mark entry windows.');
  return (data ?? []) as MarkEntryWindow[];
}

export async function saveMarkEntryWindow(
  semester: SemesterValue,
  opensAt: string,
  closesAt: string,
  year = MARKS_SHEET_YEAR,
): Promise<void> {
  const openDate = new Date(opensAt);
  const closeDate = new Date(closesAt);
  if (!Number.isFinite(openDate.getTime()) || !Number.isFinite(closeDate.getTime()) || closeDate <= openDate) {
    throw new Error('Choose a valid opening time before the closing time.');
  }
  const { error } = await supabase.from('mark_entry_windows').upsert(
    {
      year,
      semester,
      opens_at: openDate.toISOString(),
      closes_at: closeDate.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'year,semester' },
  );
  if (error) throw new Error('Could not save the mark entry window.');
}

export async function removeMarkEntryWindow(semester: SemesterValue, year = MARKS_SHEET_YEAR): Promise<void> {
  const { error } = await supabase.from('mark_entry_windows').delete().eq('year', year).eq('semester', semester);
  if (error) throw new Error('Could not close the mark entry window.');
}

export function isMarkEntryWindowOpen(window: MarkEntryWindow | null, now = new Date()): boolean {
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
