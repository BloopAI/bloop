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
    const [requestsLeft, setRequestsLeft] = useState({ used: 0, allowed: 10 });
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [hasCheckedQuota, setHasCheckedQuota] = useState(false);

    const refetchQuota = useCallback(() => {
      getQuota().then((resp) => {
        setIsSubscribed(resp.upgraded);
        setRequestsLeft({ used: resp.used, allowed: resp.allowed });
        setHasCheckedQuota(true);
      });
    }, []);

    useEffect(() => {
      refetchQuota();
    }, [refetchQuota]);

    const contextValue = useMemo(
      () => ({
        requestsLeft,
        isSubscribed,
        hasCheckedQuota,
      }),
      [requestsLeft, isSubscribed, hasCheckedQuota],
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
