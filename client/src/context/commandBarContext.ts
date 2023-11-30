import { createContext, Dispatch, SetStateAction } from 'react';
import { CommandBarActiveStepType, CommandBarStepEnum } from '../types/general';

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
  setIsVisible: Dispatch<SetStateAction<boolean>>;
};

type GeneralContextType = {
  isVisible: boolean;
};

export const CommandBarContext = {
  FooterValues: createContext<FooterValuesContext>({
    focusedItem: null,
  }),
  Handlers: createContext<HandlersContext>({
    setChosenStep: () => {},
    setFocusedItem: () => {},
    setIsVisible: () => {},
  }),
  General: createContext<GeneralContextType>({
    isVisible: false,
  }),
  CurrentStep: createContext<{ chosenStep: CommandBarActiveStepType }>({
    chosenStep: {
      id: CommandBarStepEnum.INITIAL,
    },
  }),
};
