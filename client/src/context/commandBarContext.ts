import { createContext, Dispatch, SetStateAction } from 'react';
import {
  CommandBarActiveStepType,
  CommandBarItemInvisibleType,
  CommandBarItemGeneralType,
  CommandBarItemType,
  CommandBarStepEnum,
} from '../types/general';

type FooterValuesContext = {
  focusedItem: (CommandBarItemGeneralType | CommandBarItemInvisibleType) | null;
};

type HandlersContext = {
  setFocusedItem: Dispatch<
    SetStateAction<
      CommandBarItemGeneralType | CommandBarItemInvisibleType | null
    >
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
