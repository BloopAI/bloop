import React, { createContext } from 'react';
import { LocaleType } from '../types/general';

type ContextType = {
  locale: LocaleType;
  setLocale: React.Dispatch<React.SetStateAction<LocaleType>>;
};

export const LocaleContext = createContext<ContextType>({
  locale: 'en',
  setLocale: () => {},
});
