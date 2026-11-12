import { useEffect, useState } from 'react';
import { CLASSES } from '@/lib/school';
import { supabase } from '@/lib/supabase';
import type { ClassOption } from '@/lib/school';

type ClassRow = {
  code: string;
  label: string;
  sheet_kind: 'primary' | 'secondary';
  sort_order: number;
};

export function useClasses() {
  const [classes, setClasses] = useState<ClassOption[]>(CLASSES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('classes')
      .select('code, label, sheet_kind, sort_order')
      .order('sort_order')
      .order('label')
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as ClassRow[];
        setClasses(
          rows.map((row) => ({
            value: row.code,
            label: row.label,
            sheetKind: row.sheet_kind,
            sortOrder: row.sort_order,
          })),
        );
        setError(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { classes, loading, error, reload: () => setVersion((value) => value + 1) };
}
