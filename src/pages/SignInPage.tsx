import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Notice, PageHeader, Spinner, TextField } from '@/components/ui';
import { createFirstAdmin, fetchHasAdmin } from '@/lib/staff';
import { cardClass, primaryButtonClass, secondaryButtonClass } from '@/lib/styles';
import { navigate } from '@/lib/useHashRoute';

function SignInForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setSubmitting(false);
    if (message) setError(message);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
        {submitting ? 'Signing in...' : 'Sign in'}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}

function CreateAdminForm() {
  const { signIn } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createFirstAdmin(fullName.trim(), email.trim(), password);
      const message = await signIn(email.trim(), password);
      if (message) setError(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Notice tone="info">No admin exists yet. Create the first admin account to start setting up the school.</Notice>
      <TextField label="Full name" value={fullName} onChange={setFullName} />
      <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <TextField label="Password (at least 8 characters)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
        {submitting ? 'Creating account...' : 'Create admin account'}
      </button>
    </form>
  );
}

export default function SignInPage() {
  const { loading, isStaff, isAdmin, isSuperAdmin, session, signOut } = useAuth();
  const [hasAdmin, setHasAdmin] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHasAdmin()
      .then((value) => !cancelled && setHasAdmin(value))
      .catch((err: unknown) => {
        if (!cancelled) setCheckError(err instanceof Error ? err.message : 'Could not reach the server.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isStaff) navigate(isSuperAdmin ? 'super-admin' : isAdmin ? 'admin' : 'marks');
  }, [isStaff, isAdmin, isSuperAdmin]);

  if (loading) return <Spinner label="Checking your session..." />;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Staff sign in" description="Teachers and admins sign in here to enter marks or manage the school." />
      <div className={`${cardClass} p-6 sm:p-8`}>
        {session && !isStaff ? (
          <div className="space-y-5">
            <Notice tone="info">
              This account is not set up as a teacher or admin yet. Ask the school admin to add it.
            </Notice>
            <button type="button" onClick={() => void signOut()} className={`${secondaryButtonClass} w-full`}>
              Sign out
            </button>
          </div>
        ) : hasAdmin ? (
          <>
            <SignInForm />
            {checkError && <Notice tone="info">{checkError} You can still try signing in.</Notice>}
          </>
        ) : (
          <CreateAdminForm />
        )}
        <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-blue-700" aria-hidden />
          Accounts are created by the school admin. Public visitors do not need to sign in.
        </div>
      </div>
    </div>
  );
}
