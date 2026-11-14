import { supabase } from '@/lib/supabase';

export type SchoolYear = {
  year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function readSchoolYear(row: unknown): SchoolYear | null {
  if (!row || typeof row !== 'object') return null;
  const value = row as Record<string, unknown>;
  if (typeof value.year !== 'number' || typeof value.is_active !== 'boolean') return null;
  return {
    year: value.year,
    is_active: value.is_active,
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
  };
}

export async function listSchoolYears(includeInactive = false): Promise<SchoolYear[]> {
  let query = supabase
    .from('school_years')
    .select('year, is_active, created_at, updated_at')
    .order('year', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(readSchoolYear).filter((row): row is SchoolYear => row !== null);
}

function readRpcYear(data: unknown): SchoolYear {
  const row = readSchoolYear(data);
  if (!row) throw new Error('The school year response was invalid.');
  return row;
}

export async function createSchoolYear(year: number): Promise<SchoolYear> {
  const { data, error } = await supabase.rpc('create_school_year', {
    target_year: year,
    copy_from_year: null,
  });
  if (error) throw new Error(error.message);
  return readRpcYear(data);
}

export async function renameSchoolYear(oldYear: number, newYear: number): Promise<SchoolYear> {
  const { data, error } = await supabase.rpc('rename_school_year', {
    old_year: oldYear,
    new_year: newYear,
  });
  if (error) throw new Error(error.message);
  return readRpcYear(data);
}

export async function setSchoolYearActive(year: number, active: boolean): Promise<SchoolYear> {
  const { data, error } = await supabase.rpc('set_school_year_active', {
    target_year: year,
    active,
  });
  if (error) throw new Error(error.message);
  return readRpcYear(data);
}
