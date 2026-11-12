import { useHashRoute } from '@/lib/useHashRoute';
import { AuthProvider } from '@/context/AuthContext';
import { SiteHeader } from '@/components/SiteHeader';
import { RequireRole } from '@/components/RequireRole';
import ReportsPage from '@/pages/ReportsPage';
import ResultsPage from '@/pages/ResultsPage';
import MarksEntryPage from '@/pages/MarksEntryPage';
import AdminPage from '@/pages/AdminPage';
import SuperAdminPage from '@/pages/SuperAdminPage';
import SignInPage from '@/pages/SignInPage';

function Page() {
  const route = useHashRoute();

  switch (route) {
    case 'results':
      return <ResultsPage />;
    case 'marks':
      return (
        <RequireRole>
          <MarksEntryPage />
        </RequireRole>
      );
    case 'admin':
      return (
        <RequireRole admin>
          <AdminPage />
        </RequireRole>
      );
    case 'super-admin':
      return <SuperAdminPage />;
    case 'signin':
      return <SignInPage />;
    default:
      return <ReportsPage />;
  }
}

export default function App() {
  const route = useHashRoute();

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <SiteHeader current={route} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <Page />
        </main>
      </div>
    </AuthProvider>
  );
}
