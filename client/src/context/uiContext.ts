import React, { createContext } from 'react';

type ContextType = {
  isSettingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  symbolsCollapsed: boolean;
  setSymbolsCollapsed: (v: boolean) => void;
  settingsSection: number;
  setSettingsSection: (s: number) => void;
  onBoardingState: Record<string, any>;
  setOnBoardingState: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isBugReportModalOpen: boolean;
  setBugReportModalOpen: (b: boolean) => void;
};

export const UIContext = createContext<ContextType>({
  isSettingsOpen: false,
  setSettingsOpen: (b) => {},
  symbolsCollapsed: true,
  setSymbolsCollapsed: (b) => {},
  settingsSection: 0,
  setSettingsSection: (s) => {},
  onBoardingState: {},
  setOnBoardingState: (state: Record<string, any>) => {},
  isBugReportModalOpen: false,
  setBugReportModalOpen: () => {},
});
