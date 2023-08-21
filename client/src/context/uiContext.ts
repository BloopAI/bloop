import React, { createContext } from 'react';
import { RepoSource, Theme } from '../types';
import { RepoTabType, TabType } from '../types/general';

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
  isFiltersOpen: boolean;
  setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tab: { key: string; name: string; repoName: string };
  theme: Theme;
  setTheme: (s: Theme) => void;
  isPromptGuideOpen: boolean;
  setPromptGuideOpen: (b: boolean) => void;
};

export const UIContext = {
  Settings: createContext({
    isSettingsOpen: false,
    setSettingsOpen: (b: boolean) => {},
    settingsSection: 0,
    setSettingsSection: (n: number) => {},
  }),
  Symbols: createContext({
    symbolsCollapsed: true,
    setSymbolsCollapsed: (b: boolean) => {},
  }),
  Onboarding: createContext({
    shouldShowWelcome: false,
    setShouldShowWelcome: (b: boolean) => {},
    onBoardingState: {},
    setOnBoardingState: (state: Record<string, any>) => {},
  }),
  BugReport: createContext({
    isBugReportModalOpen: false,
    setBugReportModalOpen: (b: boolean) => {},
  }),
  GitHubConnected: createContext({
    isGithubConnected: false,
    setGithubConnected: (b: boolean) => {},
    isGithubChecked: false,
  }),
  RightPanel: createContext({
    isRightPanelOpen: false,
    setRightPanelOpen: (b: boolean) => {},
  }),
  Filters: createContext<{
    isFiltersOpen: boolean;
    setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  }>({
    isFiltersOpen: false,
    setFiltersOpen: () => {},
  }),
  PromptGuide: createContext({
    isPromptGuideOpen: false,
    setPromptGuideOpen: (b: boolean) => {},
  }),
  Tab: createContext<{ tab: RepoTabType }>({
    tab: {
      key: 'initial',
      name: 'Home',
      type: TabType.REPO,
      repoName: '',
      branch: '',
      repoRef: '',
      source: RepoSource.LOCAL,
      navigationHistory: [],
    },
  }),
  Theme: createContext({
    theme: 'system' as Theme,
    setTheme: (t: Theme) => {},
  }),
};
