import React, { createContext, Dispatch, SetStateAction } from 'react';
import { RepoSource, Theme } from '../types';
import { RepoTabType, TabType } from '../types/general';

export const UIContext = {
  Settings: createContext({
    isSettingsOpen: false,
    setSettingsOpen: (b: boolean) => {},
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
    activeTab: 'initial',
  }),
  GitHubConnected: createContext({
    isGithubConnected: false,
    setGithubConnected: (b: boolean) => {},
    isGithubChecked: false,
    refreshToken: (refreshT: string) => Promise.resolve(),
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
  StudioGuide: createContext({
    isStudioGuideOpen: false,
    setStudioGuideOpen: (b: boolean) => {},
  }),
  CloudFeaturePopup: createContext({
    isCloudFeaturePopupOpen: false,
    setCloudFeaturePopupOpen: (b: boolean) => {},
  }),
  UpgradePopup: createContext({
    isUpgradePopupOpen: false,
    setUpgradePopupOpen: (b: boolean) => {},
    isWaitingUpgradePopupOpen: false,
    setWaitingUpgradePopupOpen: (b: boolean) => {},
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
  HomeScreen: createContext({
    search: '',
    setSearch: (t: string) => {},
    filterType: 'all' as 'all' | 'repos' | 'studios',
    setFilterType: (t: 'all' | 'repos' | 'studios') => {},
  }),
  AnswerSpeed: createContext<{
    preferredAnswerSpeed: 'normal' | 'fast';
    setPreferredAnswerSpeed: Dispatch<SetStateAction<'normal' | 'fast'>>;
  }>({
    preferredAnswerSpeed: 'fast',
    setPreferredAnswerSpeed: () => {},
  }),
};
