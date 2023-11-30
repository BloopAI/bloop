import { createContext, Dispatch, SetStateAction } from 'react';
import {
  CommandBarActiveStepType,
  CommandBarItemGeneralType,
  CommandBarStepEnum,
} from '../types/general';

type FooterValuesContext = {
  focusedItem: {
    footerHint?: CommandBarItemGeneralType['footerHint'];
    footerBtns?: CommandBarItemGeneralType['footerBtns'];
  } | null;
};

type HandlersContext = {
  setFocusedItem: Dispatch<
    SetStateAction<{
      footerHint?: CommandBarItemGeneralType['footerHint'];
      footerBtns?: CommandBarItemGeneralType['footerBtns'];
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
