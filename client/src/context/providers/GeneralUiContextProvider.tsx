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
  ANSWER_SPEED_KEY,
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
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
    const { isSelfServe } = useContext(DeviceContext);
    const [isGithubConnected, setGithubConnected] = useState(isSelfServe);
    const [isGithubChecked, setGithubChecked] = useState(false);
    const [shouldShowWelcome, setShouldShowWelcome] = useState(
      !getPlainFromStorage(ONBOARDING_DONE_KEY),
    );
    const [isPromptGuideOpen, setPromptGuideOpen] = useState(false);
    const [isCloudFeaturePopupOpen, setCloudFeaturePopupOpen] = useState(false);
    const [isUpgradePopupOpen, setUpgradePopupOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(
      (getPlainFromStorage(THEME) as 'system' | null) || 'system',
    );
    const [preferredAnswerSpeed, setPreferredAnswerSpeed] = useState<
      'normal' | 'fast'
    >((getPlainFromStorage(ANSWER_SPEED_KEY) as 'normal') || 'fast');

    useEffect(() => {
      savePlainToStorage(ANSWER_SPEED_KEY, preferredAnswerSpeed);
    }, [preferredAnswerSpeed]);

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
                    <UIContext.CloudFeaturePopup.Provider
                      value={cloudFeatureContextValue}
                    >
                      <UIContext.UpgradePopup.Provider
                        value={upgradePopupContextValue}
                      >
                        {children}
                      </UIContext.UpgradePopup.Provider>
                    </UIContext.CloudFeaturePopup.Provider>
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
