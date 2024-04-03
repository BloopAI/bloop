import React, {
  memo,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { UIContext } from '../uiContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  CHAT_INPUT_TYPE_KEY,
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  savePlainToStorage,
  THEME,
} from '../../services/storage';
import { Theme } from '../../types';
import {
  ChatInputType,
  ProjectSettingSections,
  SettingSections,
} from '../../types/general';
import { LocaleContext } from '../localeContext';

type Props = {};

export const UIContextProvider = memo(
  ({ children }: PropsWithChildren<Props>) => {
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState(
      SettingSections.GENERAL,
    );
    const [isProjectSettingsOpen, setProjectSettingsOpen] = useState(false);
    const [projectSettingsSection, setProjectSettingsSection] = useState(
      ProjectSettingSections.GENERAL,
    );
    const [isBugReportModalOpen, setBugReportModalOpen] = useState(false);
    const [onBoardingState, setOnBoardingState] = usePersistentState(
      {},
      'onBoardingState',
    );
    const { locale } = useContext(LocaleContext);
    const [shouldShowWelcome, setShouldShowWelcome] = useState(
      !getPlainFromStorage(ONBOARDING_DONE_KEY),
    );
    const [theme, setTheme] = useState<Theme>(
      (getPlainFromStorage(THEME) as 'system' | null) || 'system',
    );
    const [chatInputType, setChatInputType] = useState<ChatInputType>(
      (getPlainFromStorage(CHAT_INPUT_TYPE_KEY) as 'default' | null) ||
        locale === 'zhCN'
        ? 'simplified'
        : 'default',
    );
    const [isLeftSidebarFocused, setIsLeftSidebarFocused] = useState(false);

    useEffect(() => {
      if (!['dark', 'light', 'black', 'system'].includes(theme)) {
        setTheme('system');
      } else {
        savePlainToStorage(THEME, theme);
        document.body.dataset.theme = theme;
      }
    }, [theme]);

    useEffect(() => {
      savePlainToStorage(CHAT_INPUT_TYPE_KEY, chatInputType);
    }, [chatInputType]);

    const settingsContextValue = useMemo(
      () => ({
        isSettingsOpen,
        setSettingsOpen,
        settingsSection,
        setSettingsSection,
      }),
      [isSettingsOpen, settingsSection],
    );

    const projectSettingsContextValue = useMemo(
      () => ({
        isProjectSettingsOpen,
        setProjectSettingsOpen,
        projectSettingsSection,
        setProjectSettingsSection,
      }),
      [isProjectSettingsOpen, projectSettingsSection],
    );

    const onboardingContextValue = useMemo(
      () => ({
        onBoardingState,
        setOnBoardingState,
        shouldShowWelcome,
        setShouldShowWelcome,
      }),
      [onBoardingState, shouldShowWelcome],
    );

    const bugReportContextValue = useMemo(
      () => ({
        isBugReportModalOpen,
        setBugReportModalOpen,
      }),
      [isBugReportModalOpen],
    );

    const themeContextValue = useMemo(
      () => ({
        theme,
        setTheme,
      }),
      [theme],
    );

    const focusContextValue = useMemo(
      () => ({
        isLeftSidebarFocused,
        setIsLeftSidebarFocused,
      }),
      [isLeftSidebarFocused],
    );

    const chatInputTypeContextValue = useMemo(
      () => ({
        chatInputType,
        setChatInputType,
      }),
      [chatInputType],
    );

    return (
      <UIContext.Settings.Provider value={settingsContextValue}>
        <UIContext.ProjectSettings.Provider value={projectSettingsContextValue}>
          <UIContext.Onboarding.Provider value={onboardingContextValue}>
            <UIContext.BugReport.Provider value={bugReportContextValue}>
              <UIContext.Theme.Provider value={themeContextValue}>
                <UIContext.ChatInputType.Provider
                  value={chatInputTypeContextValue}
                >
                  <UIContext.Focus.Provider value={focusContextValue}>
                    {children}
                  </UIContext.Focus.Provider>
                </UIContext.ChatInputType.Provider>
              </UIContext.Theme.Provider>
            </UIContext.BugReport.Provider>
          </UIContext.Onboarding.Provider>
        </UIContext.ProjectSettings.Provider>
      </UIContext.Settings.Provider>
    );
  },
);

UIContextProvider.displayName = 'UIContextProvider';
