import { useEffect, useState } from 'react';
import { fetchClassSemester } from '@/lib/marksData';
import type { GradeSemesterData } from '@/lib/types';

export function useClassSemesterData(classCode: string, schoolYear: number, semester: number, enabled = true) {
  const [state, setState] = useState<{ data: GradeSemesterData | null; loading: boolean; error: string | null }>({
    data: null,
    loading: enabled,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchClassSemester(classCode, schoolYear, semester)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Could not load the marks.',
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classCode, schoolYear, semester, version, enabled]);

  return { ...state, reload: () => setVersion((value) => value + 1) };
}
