import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Download, ShieldCheck, Upload, RefreshCw } from 'lucide-react';
import { PageHeader, Notice, Spinner, EmptyState } from '@/components/ui';
import { RequireRole } from '@/components/RequireRole';
import {
  createBackupNow,
  downloadBackup,
  listBackups,
  restoreBackupFromFile,
  type BackupRecord,
} from '@/lib/staff';
import { cardClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';

const KIND_LABEL: Record<BackupRecord['kind'], string> = {
  daily: 'Daily backup',
  monthly: 'Monthly backup',
};

export default function SuperAdminPage() {
  return (
    <RequireRole superAdmin>
      <SuperAdminContent />
    </RequireRole>
  );
}

function SuperAdminContent() {
  return (
    <>
      <PageHeader
        title="Super admin"
        description="Automatic daily and monthly backups of every student, mark, and account. Download a backup file any time, or restore the school data from one."
      />
      <BackupManager />
    </>
  );
}

function BackupManager() {
  const [backups, setBackups] = useState<BackupRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringFile, setRestoringFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => {
    listBackups()
      .then((rows) => {
        setBackups(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load backups.'));
  };

  useEffect(load, []);

  const runBackupNow = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await createBackupNow('daily');
      setMessage('A fresh backup was created.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the backup.');
    } finally {
      setBusy(false);
    }
  };

  const runDownload = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      await downloadBackup(id);
      setMessage('The backup file was downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the backup.');
    }
  };

  const runRestore = async () => {
    if (!restoringFile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await restoreBackupFromFile(restoringFile);
      setMessage('The backup was restored. All school data now matches the backup file.');
      setRestoringFile(null);
      if (fileInput.current) fileInput.current.value = '';
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-blue-50 p-2.5 text-blue-800"><CalendarClock className="h-5 w-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</p>
              <p className="mt-1 font-semibold text-slate-900">Daily + monthly</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Backups run automatically every day at 4:00 and on the first day of each month at 5:00 (UTC).</p>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-sky-50 p-2.5 text-sky-800"><Download className="h-5 w-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Download</p>
              <p className="mt-1 font-semibold text-slate-900">Backup files</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Every backup can be downloaded as a file and kept anywhere you like.</p>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-800"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restore</p>
              <p className="mt-1 font-semibold text-slate-900">Safe recovery</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Restoring first saves a safety backup of the current data, then replaces it with the file.</p>
        </div>
      </div>

      <div className={`${cardClass} space-y-4 p-5`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Back up now</h2>
          <p className="text-sm text-slate-500">Create an extra backup immediately without waiting for the schedule.</p>
        </div>
        <button type="button" onClick={() => void runBackupNow()} disabled={busy} className={primaryButtonClass}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
          {busy ? 'Working...' : 'Back up now'}
        </button>
      </div>

      <div className={`${cardClass} space-y-4 p-5`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Restore from a backup file</h2>
          <p className="text-sm text-slate-500">
            Choose a downloaded backup file. Restoring replaces all current students, marks, subjects, assessments, classes, and staff details with the file contents.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(event) => setRestoringFile(event.target.files?.[0] ?? null)}
          className="block w-full max-w-md cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-800 hover:file:bg-blue-100"
        />
        <button type="button" onClick={() => void runRestore()} disabled={busy || !restoringFile} className={secondaryButtonClass}>
          <Upload className="h-4 w-4" aria-hidden />
          Restore this file
        </button>
      </div>

      {backups === null ? (
        <Spinner label="Loading backups..." />
      ) : backups.length === 0 ? (
        <EmptyState title="No backups yet" description="The first automatic backup appears here after the next scheduled run, or use Back up now." />
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Backup history</h2>
            <p className="mt-1 text-sm text-slate-500">Newest first. Monthly backups older than 12 months are removed automatically.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {backups.map((backup) => (
              <li key={backup.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{KIND_LABEL[backup.kind]}</p>
                  <p className="text-sm text-slate-500">{new Date(backup.created_at).toLocaleString()}</p>
                </div>
                <button type="button" onClick={() => void runDownload(backup.id)} className={secondaryButtonClass}>
                  <Download className="h-4 w-4" aria-hidden />
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
