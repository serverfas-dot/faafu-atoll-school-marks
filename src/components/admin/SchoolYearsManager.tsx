import { useState, type FormEvent } from 'react';
import { Archive, Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { Notice, Spinner } from '@/components/ui';
import { createSchoolYear, renameSchoolYear, setSchoolYearActive } from '@/lib/schoolYears';
import { useSchoolYears } from '@/lib/useSchoolYears';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';

export function SchoolYearsManager() {
  const { years, loading, error: loadError, reload } = useSchoolYears(true);
  const [newYear, setNewYear] = useState('');
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busyYear, setBusyYear] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const validateYear = (value: string): number | null => {
    const year = Number(value);
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const year = validateYear(newYear);
    if (year === null) {
      setMessage({ tone: 'error', text: 'Enter a whole school year between 2000 and 2100.' });
      return;
    }
    setBusyYear(year);
    setMessage(null);
    try {
      await createSchoolYear(year);
      setNewYear('');
      setMessage({ tone: 'success', text: `${year} was added. Its assessment setup was copied from the latest active year.` });
      reload();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not add the school year.' });
    } finally {
      setBusyYear(null);
    }
  };

  const handleRename = async (oldYear: number) => {
    const year = validateYear(editValue);
    if (year === null) {
      setMessage({ tone: 'error', text: 'Enter a whole school year between 2000 and 2100.' });
      return;
    }
    setBusyYear(oldYear);
    setMessage(null);
    try {
      await renameSchoolYear(oldYear, year);
      setEditingYear(null);
      setMessage({ tone: 'success', text: `The school year was changed to ${year}. Its records stayed connected.` });
      reload();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not rename the school year.' });
    } finally {
      setBusyYear(null);
    }
  };

  const handleToggle = async (year: number, active: boolean) => {
    setBusyYear(year);
    setMessage(null);
    try {
      await setSchoolYearActive(year, active);
      setMessage({ tone: 'success', text: active ? `${year} is available again.` : `${year} is hidden from normal selectors. Its records are preserved.` });
      reload();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not update the school year.' });
    } finally {
      setBusyYear(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardClass} space-y-3 p-5`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">School years</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Add a new year before entering marks. New years start with a copy of the latest active assessment setup, while all marks remain separate.
          </p>
        </div>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block max-w-xs flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">New school year</span>
            <input type="number" min="2000" max="2100" value={newYear} onChange={(event) => setNewYear(event.target.value)} placeholder="2027" className={inputClass} required />
          </label>
          <button type="submit" disabled={busyYear !== null} className={primaryButtonClass}>
            <Plus className="h-4 w-4" aria-hidden />
            Add year
          </button>
        </form>
      </div>

      {(loadError || message) && <Notice tone={message?.tone ?? 'error'}>{message?.text ?? loadError}</Notice>}

      {loading ? (
        <Spinner label="Loading school years..." />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <ul className="divide-y divide-slate-100">
            {years.map((item) => {
              const editing = editingYear === item.year;
              const busy = busyYear === item.year;
              return (
                <li key={item.year} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  {editing ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input type="number" min="2000" max="2100" value={editValue} onChange={(event) => setEditValue(event.target.value)} className={`${inputClass} max-w-[140px]`} aria-label={`Rename ${item.year}`} />
                      <button type="button" onClick={() => void handleRename(item.year)} disabled={busy} className={primaryButtonClass}>
                        <Check className="h-4 w-4" aria-hidden />
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingYear(null)} className={secondaryButtonClass}>
                        <X className="h-4 w-4" aria-hidden />
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-900">{item.year}</p>
                      <p className="text-sm text-slate-500">{item.is_active ? 'Available in marks, results, and reports' : 'Hidden, but historical records are preserved'}</p>
                    </div>
                  )}
                  {!editing && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setEditingYear(item.year); setEditValue(String(item.year)); }} className={secondaryButtonClass}>
                        <Pencil className="h-4 w-4" aria-hidden />
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleToggle(item.year, !item.is_active)} disabled={busy} className={item.is_active ? secondaryButtonClass : primaryButtonClass}>
                        {item.is_active ? <Archive className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                        {item.is_active ? 'Hide' : 'Restore'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
