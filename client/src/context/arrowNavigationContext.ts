import { createContext } from 'react';

// export type ArrowNavigationContextType = {
//   envConfig: EnvConfig;
//   setEnvConfig: Dispatch<SetStateAction<EnvConfig>>;
// };

export const ArrowNavigationContext = createContext({
  focusedIndex: '',
  setFocusedIndex: (s: string) => {},
});
