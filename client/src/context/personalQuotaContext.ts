import { createContext } from 'react';

type ContextType = {
  requestsLeft: {
    used: number;
    allowed: number;
  };
  isSubscribed: boolean;
  hasCheckedQuota: boolean;
};

export const PersonalQuotaContext = {
  Values: createContext<ContextType>({
    requestsLeft: {
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
