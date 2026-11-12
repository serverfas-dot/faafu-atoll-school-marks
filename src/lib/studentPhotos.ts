import { supabase } from '@/lib/supabase';

const FALLBACK_ERROR = 'Could not save the photo. Please try again.';

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

export async function uploadStudentPhoto(studentId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('studentId', studentId);
  form.append('file', file);

  const { data, error } = await supabase.functions.invoke<{ ok: boolean; photoUrl: string }>('manage-student-photo', {
    body: form,
  });
  if (error) throw new Error(await readFunctionError(error));
  if (!data || data.ok !== true || typeof data.photoUrl !== 'string') throw new Error(FALLBACK_ERROR);
  return data.photoUrl;
}
