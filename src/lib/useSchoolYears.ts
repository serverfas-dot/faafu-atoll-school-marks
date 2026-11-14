import { useEffect, useState } from 'react';
import { MARKS_SHEET_YEAR } from '@/lib/school';
import { listSchoolYears, type SchoolYear } from '@/lib/schoolYears';

export function useSchoolYears(includeInactive = false) {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSchoolYears(includeInactive)
      .then((rows) => {
        if (cancelled) return;
        setYears(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load school years.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [includeInactive, version]);

  return {
    years,
    loading,
    error,
    defaultYear: years[years.length - 1]?.year ?? MARKS_SHEET_YEAR,
    reload: () => setVersion((value) => value + 1),
  };
}
