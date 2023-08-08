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
import { gitHubStatus } from '../../services/api';
import { SettingSections } from '../../components/Settings';
import {
  getPlainFromStorage,
  savePlainToStorage,
  ONBOARDING_DONE_KEY,
  THEME,
} from '../../services/storage';
import { UITabType } from '../../types/general';
import { Theme } from '../../types';

export const UIContextProvider = memo(
  ({ children, tab }: PropsWithChildren<{ tab: UITabType }>) => {
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
        gitHubStatus().then((d) => {
          setGithubConnected(d.status === 'ok');
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

    const tabContextValue = useMemo(
      () => ({
        tab,
      }),
      [tab],
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

    return (
      <UIContext.Settings.Provider value={settingsContextValue}>
        <UIContext.Symbols.Provider value={symbolsContextValue}>
          <UIContext.Onboarding.Provider value={onboardingContextValue}>
            <UIContext.BugReport.Provider value={bugReportContextValue}>
              <UIContext.GitHubConnected.Provider value={githubContextValue}>
                <UIContext.RightPanel.Provider value={rightPanelContextValue}>
                  <UIContext.Tab.Provider value={tabContextValue}>
                    <UIContext.Theme.Provider value={themeContextValue}>
                      <UIContext.PromptGuide.Provider
                        value={promptContextValue}
                      >
                        <UIContext.Filters.Provider value={filtersContextValue}>
                          {children}
                        </UIContext.Filters.Provider>
                      </UIContext.PromptGuide.Provider>
                    </UIContext.Theme.Provider>
                  </UIContext.Tab.Provider>
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
