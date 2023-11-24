import React, {
  memo,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { UIContext } from '../uiContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { DeviceContext } from '../deviceContext';
import { getConfig, refreshToken as refreshTokenApi } from '../../services/api';
import {
  ACCESS_TOKEN_KEY,
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  REFRESH_TOKEN_KEY,
  savePlainToStorage,
  THEME,
} from '../../services/storage';
import { Theme } from '../../types';
import { EnvContext } from '../envContext';
import { ProjectSettingSections, SettingSections } from '../../types/general';

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
    const { isSelfServe } = useContext(DeviceContext);
    const { setEnvConfig, envConfig } = useContext(EnvContext);
    const [isGithubConnected, setGithubConnected] = useState(
      isSelfServe ? !!getPlainFromStorage(REFRESH_TOKEN_KEY) : false,
    );
    const [isGithubChecked, setGithubChecked] = useState(false);
    const [shouldShowWelcome, setShouldShowWelcome] = useState(
      !getPlainFromStorage(ONBOARDING_DONE_KEY),
    );
    const [tokenExpiresAt, setTokenExpiresAt] = useState(0);
    const [theme, setTheme] = useState<Theme>(
      (getPlainFromStorage(THEME) as 'system' | null) || 'system',
    );
    const [isLeftSidebarFocused, setIsLeftSidebarFocused] = useState(false);
    const [isUpgradeRequiredPopupOpen, setIsUpgradeRequiredPopupOpen] =
      useState(false);

    const refreshToken = useCallback(async (refToken: string) => {
      if (refToken) {
        const data = await refreshTokenApi(refToken);
        savePlainToStorage(ACCESS_TOKEN_KEY, data.access_token);
        setTokenExpiresAt(Date.now() + data.exp * 1000);
        setTimeout(() => getConfig().then(setEnvConfig), 100);
      } else {
        throw new Error('No refresh token provided!');
      }
    }, []);

    useEffect(() => {
      const storedToken = getPlainFromStorage(REFRESH_TOKEN_KEY);
      const tokenExpiresIn = tokenExpiresAt - Date.now();
      const timerId =
        tokenExpiresAt && storedToken
          ? window.setTimeout(
              () => {
                refreshToken(storedToken);
              },
              tokenExpiresIn - 60 * 2 * 1000,
            )
          : 0;
      return () => {
        clearTimeout(timerId);
      };
    }, [tokenExpiresAt]);

    useEffect(() => {
      if (!isSelfServe) {
        getConfig().then((d) => {
          setGithubConnected(!!d.github_user);
          setGithubChecked(true);
        });
      }
    }, []);

    useEffect(() => {
      if (envConfig.github_user) {
        setGithubConnected(!!envConfig.github_user);
        setGithubChecked(true);
      }
    }, [envConfig.github_user]);

    useEffect(() => {
      if (!['dark', 'light', 'black', 'system'].includes(theme)) {
        setTheme('system');
      } else {
        savePlainToStorage(THEME, theme);
        document.body.dataset.theme = theme;
      }
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

    const githubContextValue = useMemo(
      () => ({
        isGithubConnected,
        setGithubConnected,
        isGithubChecked,
        refreshToken,
      }),
      [isGithubChecked, isGithubConnected],
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

    const upgradePopupContextValue = useMemo(
      () => ({
        isUpgradeRequiredPopupOpen,
        setIsUpgradeRequiredPopupOpen,
      }),
      [isUpgradeRequiredPopupOpen],
    );

    return (
      <UIContext.Settings.Provider value={settingsContextValue}>
        <UIContext.ProjectSettings.Provider value={projectSettingsContextValue}>
          <UIContext.Onboarding.Provider value={onboardingContextValue}>
            <UIContext.BugReport.Provider value={bugReportContextValue}>
              <UIContext.GitHubConnected.Provider value={githubContextValue}>
                <UIContext.Theme.Provider value={themeContextValue}>
                  <UIContext.UpgradeRequiredPopup.Provider
                    value={upgradePopupContextValue}
                  >
                    <UIContext.Focus.Provider value={focusContextValue}>
                      {children}
                    </UIContext.Focus.Provider>
                  </UIContext.UpgradeRequiredPopup.Provider>
                </UIContext.Theme.Provider>
              </UIContext.GitHubConnected.Provider>
            </UIContext.BugReport.Provider>
          </UIContext.Onboarding.Provider>
        </UIContext.ProjectSettings.Provider>
      </UIContext.Settings.Provider>
    );
  },
);

UIContextProvider.displayName = 'UIContextProvider';
