import React, { createContext } from 'react';
import { Theme } from '../types';

type ContextType = {
  locale: string;
  setLocale: React.Dispatch<React.SetStateAction<string>>;
};

export const LocaleContext = createContext<ContextType>({
  locale: '',
  setLocale: () => {},
});
