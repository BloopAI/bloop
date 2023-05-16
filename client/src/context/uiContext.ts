import React, { createContext } from 'react';
import { Theme } from '../types';

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
  isGithubConnected: boolean;
  setGithubConnected: (b: boolean) => void;
  isGithubChecked: boolean;
  shouldShowWelcome: boolean;
  setShouldShowWelcome: (b: boolean) => void;
  isRightPanelOpen: boolean;
  setRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tab: { key: string; name: string; repoName: string };
  theme: Theme;
  setTheme: (s: Theme) => void;
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
  isGithubConnected: false,
  setGithubConnected: () => {},
  isGithubChecked: false,
  shouldShowWelcome: false,
  setShouldShowWelcome: () => {},
  isRightPanelOpen: false,
  setRightPanelOpen: () => {},
  tab: { key: 'initial', name: 'Home', repoName: '' },
  theme: 'default',
  setTheme: () => {},
});
