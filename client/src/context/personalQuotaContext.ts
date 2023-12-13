import { createContext } from 'react';

type ContextType = {
  requestsLeft: number;
  quota: {
    used: number;
    allowed: number;
  };
  isSubscribed: boolean;
  isPastDue: boolean;
  hasCheckedQuota: boolean;
  resetAt: string;
};

export const PersonalQuotaContext = {
  Values: createContext<ContextType>({
    requestsLeft: 10,
    quota: {
      used: 0,
      allowed: 10,
    },
    isSubscribed: false,
    isPastDue: false,
    hasCheckedQuota: false,
    resetAt: new Date().toISOString(),
  }),
  Handlers: createContext({
    refetchQuota: () => Promise.resolve(),
  }),
};
