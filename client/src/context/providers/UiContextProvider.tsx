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
      isBugReportModalOpen,
      setBugReportModalOpen,
    }),
    [
      isSettingsOpen,
      symbolsCollapsed,
      settingsSection,
      onBoardingState,
      isBugReportModalOpen,
    ],
  );
  return (
    <UIContext.Provider value={uiContextValue}>{children}</UIContext.Provider>
  );
};
