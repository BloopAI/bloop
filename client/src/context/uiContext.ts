import React, { createContext, MutableRefObject } from 'react';

type ContextType = {
  isSettingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  symbolsCollapsed: boolean;
  setSymbolsCollapsed: (v: boolean) => void;
  settingsSection: number;
  setSettingsSection: (s: number) => void;
  onBoardingState: Record<string, any>;
  setOnBoardingState: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isBugReportModalOpen: boolean;
  setBugReportModalOpen: (b: boolean) => void;
  isGithubConnected: boolean;
  setGithubConnected: (b: boolean) => void;
  isGithubChecked: boolean;
  funcRefs: {
    searchSubmitRef: MutableRefObject<() => void | null>;
    codeSelectStartRef: MutableRefObject<
      (lineNum: number, charNum: number) => void | null
    >;
    codeSelectEndRef: MutableRefObject<
      (lineNum: number, charNum: number) => void | null
    >;
    resultsClickHandlers: MutableRefObject<(() => void | null)[]>;
  };
};

export const UIContext = createContext<ContextType>({
  isSettingsOpen: false,
  setSettingsOpen: (b) => {},
  symbolsCollapsed: true,
  setSymbolsCollapsed: (b) => {},
  settingsSection: 0,
  setSettingsSection: (s) => {},
  onBoardingState: {},
  setOnBoardingState: (state: Record<string, any>) => {},
  isBugReportModalOpen: false,
  setBugReportModalOpen: () => {},
  isGithubConnected: false,
  setGithubConnected: () => {},
  isGithubChecked: false,
  // @ts-ignore
  funcRefs: {},
});
