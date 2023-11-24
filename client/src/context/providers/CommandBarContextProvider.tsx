import { memo, PropsWithChildren, useMemo, useState } from 'react';
import { CommandBarContext } from '../commandBarContext';
import {
  CommandBarActiveStepType,
  CommandBarItemGeneralType,
  CommandBarItemInvisibleType,
  CommandBarStepEnum,
} from '../../types/general';

type Props = {};

const CommandBarContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [focusedItem, setFocusedItem] = useState<
    CommandBarItemGeneralType | CommandBarItemInvisibleType | null
  >(null);
  const [isVisible, setIsVisible] = useState(false);
  const [chosenStep, setChosenStep] = useState<CommandBarActiveStepType>({
    id: CommandBarStepEnum.INITIAL,
  });
  const [focusedTabItems, setFocusedTabItems] = useState<
    CommandBarItemGeneralType[]
  >([]);

  const currentStepContextValue = useMemo(() => ({ chosenStep }), [chosenStep]);

  const footerValuesContextValue = useMemo(() => {
    return {
      focusedItem,
    };
  }, [focusedItem]);

  const handlersContextValue = useMemo(() => {
    return {
      setFocusedItem,
      setChosenStep,
      setIsVisible,
      setFocusedTabItems,
    };
  }, []);

  const generalContextValue = useMemo(() => {
    return {
      isVisible,
    };
  }, [isVisible]);

  const tabContextValue = useMemo(
    () => ({
      tabItems: focusedTabItems,
    }),
    [focusedTabItems],
  );

  return (
    <CommandBarContext.Handlers.Provider value={handlersContextValue}>
      <CommandBarContext.General.Provider value={generalContextValue}>
        <CommandBarContext.CurrentStep.Provider value={currentStepContextValue}>
          <CommandBarContext.FooterValues.Provider
            value={footerValuesContextValue}
          >
            <CommandBarContext.FocusedTab.Provider value={tabContextValue}>
              {children}
            </CommandBarContext.FocusedTab.Provider>
          </CommandBarContext.FooterValues.Provider>
        </CommandBarContext.CurrentStep.Provider>
      </CommandBarContext.General.Provider>
    </CommandBarContext.Handlers.Provider>
  );
};

export default memo(CommandBarContextProvider);
