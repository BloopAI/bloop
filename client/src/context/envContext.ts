import { createContext, Dispatch, SetStateAction } from 'react';
import { EnvConfig } from '../types/general';

export type EnvContextType = {
  envConfig: EnvConfig;
  setEnvConfig: Dispatch<SetStateAction<EnvConfig>>;
};

export const EnvContext = createContext<EnvContextType>({
  envConfig: {},
  setEnvConfig: () => {},
});
