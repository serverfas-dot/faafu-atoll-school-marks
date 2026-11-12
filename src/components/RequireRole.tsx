import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Spinner, EmptyState } from '@/components/ui';
import SignInPage from '@/pages/SignInPage';
import { navigate } from '@/lib/useHashRoute';

export function RequireRole({ admin = false, superAdmin = false, children }: { admin?: boolean; superAdmin?: boolean; children: ReactNode }) {
  const { loading, isStaff, isAdmin, isSuperAdmin, session } = useAuth();

  useEffect(() => {
    if (admin && isStaff && !isAdmin) navigate('marks');
  }, [admin, isAdmin, isStaff]);

  if (loading) return <Spinner label="Checking your access..." />;
  if (!isStaff) return session ? (
    <EmptyState
      title="No access yet"
      description="This account is not set up as a teacher or admin. Ask the school admin to add it."
    />
  ) : <SignInPage />;
  if (superAdmin && !isSuperAdmin) {
    return <EmptyState title="Super admins only" description="Only the super admin can open this page." />;
  }
  if (admin && !isAdmin) return <Spinner label="Opening Marks entry..." />;
  return <>{children}</>;
}
