import { createContext, Dispatch, SetStateAction } from 'react';
import { CommandBarStepEnum } from '../types/general';

type FooterValuesContext = {
  focusedItem: {
    footerHint?: string;
    footerBtns?: {
      label: string;
      shortcut?: string[];
    }[];
  } | null;
};

type HandlersContext = {
  setFocusedItem: Dispatch<
    SetStateAction<{
      footerHint?: string;
      footerBtns?: {
        label: string;
        shortcut?: string[];
      }[];
    } | null>
  >;
  setChosenStep: Dispatch<
    SetStateAction<{
      id: CommandBarStepEnum;
      data?: Record<string, any>;
    }>
  >;
};

type GeneralContextType = {
  isVisible: boolean;
  setIsVisible: Dispatch<SetStateAction<boolean>>;
};

export const CommandBarContext = {
  FooterValues: createContext<FooterValuesContext>({
    focusedItem: null,
  }),
  Handlers: createContext<HandlersContext>({
    setChosenStep: () => {},
    setFocusedItem: () => {},
  }),
  General: createContext<GeneralContextType>({
    isVisible: false,
    setIsVisible: () => {},
  }),
};
