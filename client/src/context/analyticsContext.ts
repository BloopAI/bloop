import { createContext } from 'react';

export interface AnalyticsContextProps {
  analyticsLoaded: boolean;
  isAnalyticsAllowed: boolean;
  setIsAnalyticsAllowed: (b: boolean) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextProps>({
  analyticsLoaded: false,
  isAnalyticsAllowed: false,
  setIsAnalyticsAllowed: () => {},
});
