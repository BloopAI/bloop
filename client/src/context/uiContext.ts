import { createContext, Dispatch, SetStateAction } from 'react';
import { Theme } from '../types';
import {
  ChatInputType,
  OnboardingStateType,
  ProjectSettingSections,
  SettingSections,
} from '../types/general';

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
  Onboarding: createContext<{
    onBoardingState: OnboardingStateType;
    setOnBoardingState: Dispatch<SetStateAction<OnboardingStateType>>;
  }>({
    onBoardingState: {},
    setOnBoardingState: () => {},
  }),
  BugReport: createContext({
    isBugReportModalOpen: false,
    setBugReportModalOpen: (b: boolean) => {},
  }),
  Theme: createContext({
    theme: 'system' as Theme,
    setTheme: (t: Theme) => {},
  }),
  Focus: createContext({
    isLeftSidebarFocused: false,
    setIsLeftSidebarFocused: (b: boolean) => {},
  }),
  ChatInputType: createContext({
    chatInputType: 'default' as ChatInputType,
    setChatInputType: (t: ChatInputType) => {},
  }),
};
