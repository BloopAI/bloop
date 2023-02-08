import { useEffect } from 'react';
import { usePersistentState } from './usePersistentState';

export const useRouterSate = (router: any) => {
  const FORCE_ONBOARDING = import.meta.env.ONBOARDING;
  const [routerState, setRouterState] = usePersistentState<string | null>(
    null,
    'routerState',
  );
  router.subscribe((s: any) => {
    setRouterState(s.location.pathname);
  });

  useEffect(() => {
    if (routerState && !FORCE_ONBOARDING) {
      router.navigate(routerState);
    }
  }, [routerState]);
};
