import { createContext, Dispatch, SetStateAction } from 'react';
import {
  CommandBarActiveStepType,
  CommandBarItemInvisibleType,
  CommandBarItemGeneralType,
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
  setFocusedTabItems: Dispatch<SetStateAction<CommandBarItemGeneralType[]>>;
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
    setFocusedTabItems: () => {},
  }),
  General: createContext<GeneralContextType>({
    isVisible: false,
  }),
  CurrentStep: createContext<{ chosenStep: CommandBarActiveStepType }>({
    chosenStep: {
      id: CommandBarStepEnum.INITIAL,
    },
  }),
  FocusedTab: createContext<{
    tabItems: CommandBarItemGeneralType[];
  }>({
    tabItems: [],
  }),
};
