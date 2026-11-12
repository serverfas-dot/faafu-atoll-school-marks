import { supabase } from '@/lib/supabase';

const FALLBACK_ERROR = 'Something went wrong. Please try again.';
const STAFF_REQUEST_TIMEOUT_MS = 8000;

async function readFunctionError(error: unknown): Promise<string> {
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      return FALLBACK_ERROR;
    }
  }
  return FALLBACK_ERROR;
}

async function invokeStaffFunction<T>(body: Record<string, unknown>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('The staff service is taking too long to respond. Please try again.')), STAFF_REQUEST_TIMEOUT_MS);
  });

  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<T>('manage-staff', { body }),
      timeout,
    ]);
    if (error) throw new Error(await readFunctionError(error));
    return data as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function fetchHasAdmin(): Promise<boolean> {
  const result = await invokeStaffFunction<{ hasAdmin: boolean }>({ action: 'status' });
  return result.hasAdmin;
}

export async function createFirstAdmin(fullName: string, email: string, password: string): Promise<void> {
  await invokeStaffFunction<{ ok: boolean }>({ action: 'bootstrap', fullName, email, password });
}

export async function createTeacherAccount(fullName: string, email: string, password: string): Promise<void> {
  await invokeStaffFunction<{ ok: boolean }>({ action: 'create_teacher', fullName, email, password });
}

export async function updateTeacherName(teacherId: string, fullName: string): Promise<void> {
  await invokeStaffFunction<{ ok: boolean }>({ action: 'update_teacher', teacherId, fullName });
}

export async function updateStaffRole(staffId: string, role: 'super_admin' | 'admin' | 'teacher'): Promise<void> {
  await invokeStaffFunction<{ ok: boolean }>({ action: 'update_role', staffId, role });
}

export async function setStaffPassword(staffId: string, password: string): Promise<void> {
  await invokeStaffFunction<{ ok: boolean }>({ action: 'set_password', staffId, password });
}

export async function deleteTeacherAccount(teacherId: string): Promise<void> {
  await invokeStaffFunction<{ ok: boolean }>({ action: 'delete_teacher', teacherId });
}

export type BackupRecord = {
  id: string;
  kind: 'daily' | 'monthly';
  created_at: string;
  created_by: string | null;
};

export type BackupPayload = Record<string, unknown>;

export async function listBackups(): Promise<BackupRecord[]> {
  const { data, error } = await supabase
    .from('staff_backups')
    .select('id, kind, created_at, created_by')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BackupRecord[];
}

export async function downloadBackup(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('staff_backups')
    .select('payload')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('This backup no longer exists.');
  const blob = new Blob([JSON.stringify((data as { payload: BackupPayload }).payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `school-backup-${id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function createBackupNow(kind: 'daily' | 'monthly'): Promise<void> {
  const { error } = await supabase.rpc('create_backup', { backup_kind: kind });
  if (error) throw new Error(error.message);
}

export async function restoreBackupFromFile(file: File): Promise<void> {
  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a valid backup file.');
  }
  const { error } = await supabase.functions.invoke('restore-backup', { body: { action: 'restore', payload } });
  if (error) throw new Error(await readFunctionError(error));
}
