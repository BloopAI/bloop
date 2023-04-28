import React, {
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
  ONBOARDING_DONE_KEY,
} from '../../services/storage';
import { UITabType } from '../../types/general';

export const UIContextProvider = ({
  children,
  tab,
}: PropsWithChildren<{ tab: UITabType }>) => {
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

  useEffect(() => {
    if (!isSelfServe) {
      gitHubStatus().then((d) => {
        setGithubConnected(d.status === 'ok');
        setGithubChecked(true);
      });
    }
  }, []);

  const uiContextValue = useMemo(
    () => ({
      isSettingsOpen,
      setSettingsOpen,
      symbolsCollapsed,
      setSymbolsCollapsed,
      settingsSection,
      setSettingsSection,
      onBoardingState,
      setOnBoardingState,
      isBugReportModalOpen,
      setBugReportModalOpen,
      isGithubConnected,
      setGithubConnected,
      isGithubChecked,
      shouldShowWelcome,
      setShouldShowWelcome,
      isRightPanelOpen,
      setRightPanelOpen,
      tab,
    }),
    [
      isSettingsOpen,
      symbolsCollapsed,
      settingsSection,
      onBoardingState,
      isBugReportModalOpen,
      isGithubConnected,
      isGithubChecked,
      shouldShowWelcome,
      isRightPanelOpen,
      tab,
    ],
  );
  return (
    <UIContext.Provider value={uiContextValue}>{children}</UIContext.Provider>
  );
};
