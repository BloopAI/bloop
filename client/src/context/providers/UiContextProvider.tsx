import React, { PropsWithChildren, useMemo, useState } from 'react';
import { UIContext } from '../uiContext';
import { usePersistentState } from '../../hooks/usePersistentState';

export const UIContextProvider = ({ children }: PropsWithChildren) => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isBugReportModalOpen, setBugReportModalOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState(0);
  const [symbolsCollapsed, setSymbolsCollapsed] = useState(true);
  const [onBoardingState, setOnBoardingState] = usePersistentState(
    {},
    'onBoardingState',
  );
  const [backButtonEnabled, setBackButtonEnabled] = useState(false);
  const [backButtonHandler, setBackButtonHandler] = useState(() => () => {});
  const uiContextValue = useMemo(
    () => ({
      isSettingsOpen,
      setSettingsOpen,
      symbolsCollapsed,
      setSymbolsCollapsed,
      settingsSection,
      setSettingsSection,
      onBoardingState,
      setOnBoardingState,
      backButtonEnabled,
      setBackButtonEnabled,
      backButtonHandler,
      setBackButtonHandler,
      isBugReportModalOpen,
      setBugReportModalOpen,
    }),
    [
      isSettingsOpen,
      symbolsCollapsed,
      settingsSection,
      onBoardingState,
      backButtonEnabled,
      backButtonHandler,
      isBugReportModalOpen,
    ],
  );
  return (
    <UIContext.Provider value={uiContextValue}>{children}</UIContext.Provider>
  );
};
