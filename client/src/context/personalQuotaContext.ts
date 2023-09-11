import { createContext } from 'react';

type ContextType = {
  requestsLeft: number;
  quota: {
    used: number;
    allowed: number;
  };
  isSubscribed: boolean;
  hasCheckedQuota: boolean;
};

export const PersonalQuotaContext = {
  Values: createContext<ContextType>({
    requestsLeft: 10,
    quota: {
      used: 0,
      allowed: 10,
    },
    isSubscribed: false,
    hasCheckedQuota: false,
  }),
  Handlers: createContext({
    refetchQuota: () => {},
  }),
};
