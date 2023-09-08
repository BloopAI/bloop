import { createContext } from 'react';

type ContextType = {
  requestsLeft: number;
  isSubscribed: boolean;
  hasCheckedQuota: boolean;
};

export const PersonalQuotaContext = {
  Values: createContext<ContextType>({
    requestsLeft: 10,
    isSubscribed: false,
    hasCheckedQuota: false,
  }),
  Handlers: createContext({
    refetchQuota: () => {},
  }),
};
