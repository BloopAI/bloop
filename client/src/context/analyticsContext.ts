import { createContext } from 'react';

export interface AnalyticsContextProps {
  analyticsLoaded: boolean;
}

export const AnalyticsContext = createContext<AnalyticsContextProps>({
  analyticsLoaded: false,
});
