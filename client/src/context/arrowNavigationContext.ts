import { createContext } from 'react';

export const ArrowNavigationContext = createContext({
  focusedIndex: '',
  setFocusedIndex: (s: string) => {},
  handleClose: () => {},
});
