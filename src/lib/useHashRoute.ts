import { useEffect, useState } from 'react';

export type Route = 'reports' | 'results' | 'marks' | 'admin' | 'super-admin' | 'signin';

const DEFAULT_ROUTE: Route = 'reports';

const readRoute = (): Route => {
  const value = window.location.hash.replace(/^#\/?/, '');
  const known: Route[] = ['reports', 'results', 'marks', 'admin', 'super-admin', 'signin'];
  return known.includes(value as Route) ? (value as Route) : DEFAULT_ROUTE;
};

export function navigate(route: Route) {
  window.location.hash = `/${route}`;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const handleChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);

  return route;
}
