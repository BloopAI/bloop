import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UIContext } from '../uiContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { DeviceContext } from '../deviceContext';
import { gitHubStatus } from '../../services/api';
import { SettingSections } from '../../components/Settings';

export const UIContextProvider = ({ children }: PropsWithChildren) => {
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTypeSelectBtn = useRef<HTMLButtonElement>(null);
  const searchTypeRegexBtn = useRef<HTMLAnchorElement>(null);
  const searchTypeNLBtn = useRef<HTMLAnchorElement>(null);
  const coCursor = useRef<HTMLDivElement>(null);
  const fullCodeRef = useRef<HTMLDivElement>(null);
  const searchSubmitRef = useRef<() => void>(() => {});
  const codeSelectStartRef = useRef<(lineNum: number, charNum: number) => void>(
    () => {},
  );
  const codeSelectEndRef = useRef<(lineNum: number, charNum: number) => void>(
    () => {},
  );

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
      uiRefs: {
        searchInputRef,
        searchTypeSelectBtn,
        searchTypeNLBtn,
        searchTypeRegexBtn,
        coCursor,
        searchSubmitRef,
        codeSelectStartRef,
        codeSelectEndRef,
        fullCodeRef,
      },
    }),
    [
      isSettingsOpen,
      symbolsCollapsed,
      settingsSection,
      onBoardingState,
      isBugReportModalOpen,
      isGithubConnected,
      isGithubChecked,
    ],
  );
  return (
    <UIContext.Provider value={uiContextValue}>{children}</UIContext.Provider>
  );
};
