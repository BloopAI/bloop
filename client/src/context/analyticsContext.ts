import { Analytics } from '@segment/analytics-next';
import { createContext } from 'react';

export interface AnalyticsContextProps {
  analytics: Analytics | undefined;
  isAnalyticsAllowed: boolean;
  setIsAnalyticsAllowed: (b: boolean) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextProps>({
  analytics: undefined,
  isAnalyticsAllowed: false,
  setIsAnalyticsAllowed: () => {},
});
