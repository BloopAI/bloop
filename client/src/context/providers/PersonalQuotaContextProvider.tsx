import React, {
  memo,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getQuota } from '../../services/api';
import { PersonalQuotaContext } from '../personalQuotaContext';

type Props = {};

export const PersonalQuotaContextProvider = memo(
  ({ children }: PropsWithChildren<Props>) => {
    const [quota, setQuota] = useState({ used: 0, allowed: 10 });
    const [requestsLeft, setRequestsLeft] = useState(10);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [hasCheckedQuota, setHasCheckedQuota] = useState(false);
    const [resetAt, setResetAt] = useState(new Date().toISOString());

    const refetchQuota = useCallback(() => {
      getQuota().then((resp) => {
        setIsSubscribed(resp.upgraded);
        setQuota((prev) => {
          const newState = { used: resp.used, allowed: resp.allowed };
          if (JSON.stringify(prev) === JSON.stringify(newState)) {
            return prev;
          }
          return newState;
        });
        setRequestsLeft(Math.max(resp.allowed - resp.used, 0));
        setHasCheckedQuota(true);
        setResetAt(resp.reset_at);
      });
    }, []);

    useEffect(() => {
      refetchQuota();
      const intervalId = setInterval(() => refetchQuota(), 10 * 60 * 1000);
      return () => {
        clearInterval(intervalId);
      };
    }, [refetchQuota]);

    const contextValue = useMemo(
      () => ({
        requestsLeft,
        quota,
        isSubscribed,
        hasCheckedQuota,
        resetAt,
      }),
      [requestsLeft, isSubscribed, hasCheckedQuota, quota, resetAt],
    );

    const handlersContextValue = useMemo(
      () => ({ refetchQuota }),
      [refetchQuota],
    );

    return (
      <PersonalQuotaContext.Handlers.Provider value={handlersContextValue}>
        <PersonalQuotaContext.Values.Provider value={contextValue}>
          {children}
        </PersonalQuotaContext.Values.Provider>
      </PersonalQuotaContext.Handlers.Provider>
    );
  },
);

PersonalQuotaContextProvider.displayName = 'StudioContextProvider';
