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

    const refetchQuota = useCallback(() => {
      getQuota().then((resp) => {
        setIsSubscribed(resp.upgraded);
        setQuota({ used: resp.used, allowed: resp.allowed });
        setRequestsLeft(Math.max(resp.allowed - resp.used, 0));
        setHasCheckedQuota(true);
      });
    }, []);

    useEffect(() => {
      refetchQuota();
    }, [refetchQuota]);

    const contextValue = useMemo(
      () => ({
        requestsLeft,
        quota,
        isSubscribed,
        hasCheckedQuota,
      }),
      [requestsLeft, isSubscribed, hasCheckedQuota, quota],
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
