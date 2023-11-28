import {
  Dispatch,
  memo,
  PropsWithChildren,
  SetStateAction,
  useMemo,
  useState,
} from 'react';
import { CommandBarContext } from '../commandBarContext';
import { CommandBarStepEnum } from '../../types/general';

type Props = {
  setChosenStep: Dispatch<
    SetStateAction<{
      id: CommandBarStepEnum;
      data?: Record<string, any>;
    }>
  >;
  isVisible: boolean;
  setIsVisible: Dispatch<SetStateAction<boolean>>;
};

const CommandBarContextProvider = ({
  children,
  setChosenStep,
  isVisible,
  setIsVisible,
}: PropsWithChildren<Props>) => {
  const [focusedItem, setFocusedItem] = useState<{
    footerHint?: string;
    footerBtns?: { label: string; shortcut?: string[] }[];
  } | null>(null);

  const footerValuesContextValue = useMemo(() => {
    return {
      focusedItem,
    };
  }, [focusedItem]);

  const handlersContextValue = useMemo(() => {
    return {
      setFocusedItem,
      setChosenStep,
    };
  }, [setChosenStep]);

  const generalContextValue = useMemo(() => {
    return {
      isVisible,
      setIsVisible,
    };
  }, [isVisible, setIsVisible]);

  return (
    <CommandBarContext.Handlers.Provider value={handlersContextValue}>
      <CommandBarContext.General.Provider value={generalContextValue}>
        <CommandBarContext.FooterValues.Provider
          value={footerValuesContextValue}
        >
          {children}
        </CommandBarContext.FooterValues.Provider>
      </CommandBarContext.General.Provider>
    </CommandBarContext.Handlers.Provider>
  );
};

export default memo(CommandBarContextProvider);
