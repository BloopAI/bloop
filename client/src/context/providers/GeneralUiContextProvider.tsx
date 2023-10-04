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
import { SettingSections } from '../../components/Settings';
import {
  ACCESS_TOKEN_KEY,
  ANSWER_SPEED_KEY,
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  REFRESH_TOKEN_KEY,
  savePlainToStorage,
  THEME,
} from '../../services/storage';
import { Theme } from '../../types';

type Props = {
  activeTab: string;
};

export const GeneralUiContextProvider = memo(
  ({ children, activeTab }: PropsWithChildren<Props>) => {
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [isBugReportModalOpen, setBugReportModalOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState(
      SettingSections.GENERAL,
    );
    const [onBoardingState, setOnBoardingState] = usePersistentState(
      {},
      'onBoardingState',
    );
    const { isSelfServe, setEnvConfig } = useContext(DeviceContext);
    const [isGithubConnected, setGithubConnected] = useState(
      isSelfServe ? !!getPlainFromStorage(REFRESH_TOKEN_KEY) : false,
    );
    const [isGithubChecked, setGithubChecked] = useState(false);
    const [shouldShowWelcome, setShouldShowWelcome] = useState(
      !getPlainFromStorage(ONBOARDING_DONE_KEY),
    );
    const [isPromptGuideOpen, setPromptGuideOpen] = useState(false);
    const [isStudioGuideOpen, setStudioGuideOpen] = useState(false);
    const [isCloudFeaturePopupOpen, setCloudFeaturePopupOpen] = useState(false);
    const [isUpgradePopupOpen, setUpgradePopupOpen] = useState(false);
    const [tokenExpiresAt, setTokenExpiresAt] = useState(0);
    const [theme, setTheme] = useState<Theme>(
      (getPlainFromStorage(THEME) as 'system' | null) || 'system',
    );
    const [preferredAnswerSpeed, setPreferredAnswerSpeed] = useState<
      'normal' | 'fast'
    >((getPlainFromStorage(ANSWER_SPEED_KEY) as 'normal') || 'normal');

    useEffect(() => {
      savePlainToStorage(ANSWER_SPEED_KEY, preferredAnswerSpeed);
    }, [preferredAnswerSpeed]);

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
      const tokenExpiresIn = Date.now() - tokenExpiresAt;
      const timerId =
        tokenExpiresAt && storedToken
          ? window.setTimeout(
              () => {
                refreshToken(storedToken);
              },
              tokenExpiresIn - 60 * 1000,
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
        activeTab,
      }),
      [isBugReportModalOpen, activeTab],
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

    const promptContextValue = useMemo(
      () => ({
        isPromptGuideOpen,
        setPromptGuideOpen,
      }),
      [isPromptGuideOpen],
    );

    const studioContextValue = useMemo(
      () => ({
        isStudioGuideOpen,
        setStudioGuideOpen,
      }),
      [isStudioGuideOpen],
    );

    const cloudFeatureContextValue = useMemo(
      () => ({
        isCloudFeaturePopupOpen,
        setCloudFeaturePopupOpen,
      }),
      [isCloudFeaturePopupOpen],
    );

    const upgradePopupContextValue = useMemo(
      () => ({
        isUpgradePopupOpen,
        setUpgradePopupOpen,
      }),
      [isUpgradePopupOpen],
    );

    const answerSpeedContextValue = useMemo(
      () => ({
        preferredAnswerSpeed,
        setPreferredAnswerSpeed,
      }),
      [preferredAnswerSpeed],
    );

    return (
      <UIContext.Settings.Provider value={settingsContextValue}>
        <UIContext.Onboarding.Provider value={onboardingContextValue}>
          <UIContext.BugReport.Provider value={bugReportContextValue}>
            <UIContext.GitHubConnected.Provider value={githubContextValue}>
              <UIContext.Theme.Provider value={themeContextValue}>
                <UIContext.AnswerSpeed.Provider value={answerSpeedContextValue}>
                  <UIContext.PromptGuide.Provider value={promptContextValue}>
                    <UIContext.StudioGuide.Provider value={studioContextValue}>
                      <UIContext.CloudFeaturePopup.Provider
                        value={cloudFeatureContextValue}
                      >
                        <UIContext.UpgradePopup.Provider
                          value={upgradePopupContextValue}
                        >
                          {children}
                        </UIContext.UpgradePopup.Provider>
                      </UIContext.CloudFeaturePopup.Provider>
                    </UIContext.StudioGuide.Provider>
                  </UIContext.PromptGuide.Provider>
                </UIContext.AnswerSpeed.Provider>
              </UIContext.Theme.Provider>
            </UIContext.GitHubConnected.Provider>
          </UIContext.BugReport.Provider>
        </UIContext.Onboarding.Provider>
      </UIContext.Settings.Provider>
    );
  },
);

GeneralUiContextProvider.displayName = 'GeneralUiContextProvider';
