import { createContext } from 'react';
import { Theme } from '../types';
import { ProjectSettingSections, SettingSections } from '../types/general';

export const UIContext = {
  Settings: createContext({
    isSettingsOpen: false,
    setSettingsOpen: (b: boolean) => {},
    settingsSection: SettingSections.GENERAL,
    setSettingsSection: (s: SettingSections) => {},
  }),
  ProjectSettings: createContext({
    isProjectSettingsOpen: false,
    setProjectSettingsOpen: (b: boolean) => {},
    projectSettingsSection: ProjectSettingSections.GENERAL,
    setProjectSettingsSection: (s: ProjectSettingSections) => {},
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
    refreshToken: (refreshT: string) => Promise.resolve(),
  }),
  Theme: createContext({
    theme: 'system' as Theme,
    setTheme: (t: Theme) => {},
  }),
  Focus: createContext({
    isLeftSidebarFocused: false,
    setIsLeftSidebarFocused: (b: boolean) => {},
  }),
  UpgradeRequiredPopup: createContext({
    isUpgradeRequiredPopupOpen: false,
    setIsUpgradeRequiredPopupOpen: (b: boolean) => {},
  }),
};
