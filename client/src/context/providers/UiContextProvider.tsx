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
import { DeviceContext } from '../deviceContext';
import { getConfig } from '../../services/api';
import { SettingSections } from '../../components/Settings';
import {
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  savePlainToStorage,
  THEME,
} from '../../services/storage';
import { HomeTabType, RepoTabType, TabType } from '../../types/general';
import { Theme } from '../../types';

export const UIContextProvider = memo(
  ({
    children,
    tab,
  }: PropsWithChildren<{ tab: RepoTabType | HomeTabType }>) => {
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [isBugReportModalOpen, setBugReportModalOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState(
      SettingSections.GENERAL,
    );
    const [symbolsCollapsed, setSymbolsCollapsed] = useState(true);
    const [onBoardingState, setOnBoardingState] = usePersistentState(
      {},
      'onBoardingState',
    );
    const { isSelfServe } = useContext(DeviceContext);
    const [isGithubConnected, setGithubConnected] = useState(isSelfServe);
    const [isGithubChecked, setGithubChecked] = useState(false);
    const [shouldShowWelcome, setShouldShowWelcome] = useState(
      !getPlainFromStorage(ONBOARDING_DONE_KEY),
    );
    const [isRightPanelOpen, setRightPanelOpen] = useState(false);
    const [isPromptGuideOpen, setPromptGuideOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(
      (getPlainFromStorage(THEME) as 'system' | null) || 'system',
    );
    const [isFiltersOpen, setFiltersOpen] = useState(true);

    useEffect(() => {
      if (!isSelfServe) {
        getConfig().then((d) => {
          setGithubConnected(!!d.github_user);
          setGithubChecked(true);
        });
      }
    }, []);

    useEffect(() => {
      savePlainToStorage(THEME, theme);
      document.body.dataset.theme = theme;
    }, [theme]);

    const settingsContextValue = useMemo(
      () => ({
        isSettingsOpen,
        setSettingsOpen,
        settingsSection,
        setSettingsSection,
      }),
      [isSettingsOpen, settingsSection],
    );

    const symbolsContextValue = useMemo(
      () => ({
        symbolsCollapsed,
        setSymbolsCollapsed,
      }),
      [symbolsCollapsed],
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

    const githubContextValue = useMemo(
      () => ({
        isGithubConnected,
        setGithubConnected,
        isGithubChecked,
      }),
      [isGithubChecked, isGithubConnected],
    );

    const rightPanelContextValue = useMemo(
      () => ({
        isRightPanelOpen,
        setRightPanelOpen,
      }),
      [isRightPanelOpen],
    );

    const themeContextValue = useMemo(
      () => ({
        theme,
        setTheme,
      }),
      [theme],
    );

    const promptContextValue = useMemo(
      () => ({
        isPromptGuideOpen,
        setPromptGuideOpen,
      }),
      [isPromptGuideOpen],
    );

    const filtersContextValue = useMemo(
      () => ({
        isFiltersOpen,
        setFiltersOpen,
      }),
      [isFiltersOpen],
    );

    const WrappedChildren = useMemo(() => {
      return tab.type === TabType.REPO ? (
        <UIContext.Tab.Provider value={{ tab }}>
          {children}
        </UIContext.Tab.Provider>
      ) : (
        children
      );
    }, [tab]);

    return (
      <UIContext.Settings.Provider value={settingsContextValue}>
        <UIContext.Symbols.Provider value={symbolsContextValue}>
          <UIContext.Onboarding.Provider value={onboardingContextValue}>
            <UIContext.BugReport.Provider value={bugReportContextValue}>
              <UIContext.GitHubConnected.Provider value={githubContextValue}>
                <UIContext.RightPanel.Provider value={rightPanelContextValue}>
                  <UIContext.Theme.Provider value={themeContextValue}>
                    <UIContext.PromptGuide.Provider value={promptContextValue}>
                      <UIContext.Filters.Provider value={filtersContextValue}>
                        {WrappedChildren}
                      </UIContext.Filters.Provider>
                    </UIContext.PromptGuide.Provider>
                  </UIContext.Theme.Provider>
                </UIContext.RightPanel.Provider>
              </UIContext.GitHubConnected.Provider>
            </UIContext.BugReport.Provider>
          </UIContext.Onboarding.Provider>
        </UIContext.Symbols.Provider>
      </UIContext.Settings.Provider>
    );
  },
);

UIContextProvider.displayName = 'UIContextProvider';
