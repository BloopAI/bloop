import { createContext, Dispatch, SetStateAction } from 'react';
import { TabType } from '../types/general';

type HandlersContextType = {
  openNewTab: (path: string, repoName: string) => void;
  closeTab: (key: string, side: 'left' | 'right') => void;
  setActiveLeftTab: Dispatch<SetStateAction<TabType | null>>;
  setActiveRightTab: Dispatch<SetStateAction<TabType | null>>;
  setFocusedPanel: (panel: 'left' | 'right') => void;
  setLeftTabs: Dispatch<SetStateAction<TabType[]>>;
  setRightTabs: Dispatch<SetStateAction<TabType[]>>;
};

export const TabsContext = {
  Handlers: createContext<HandlersContextType>({
    openNewTab: (path: string, repoName: string) => {},
    closeTab: (key: string, side: 'left' | 'right') => {},
    setActiveLeftTab: () => {},
    setActiveRightTab: () => {},
    setFocusedPanel: (panel: 'left' | 'right') => {},
    setLeftTabs: () => {},
    setRightTabs: () => {},
  }),
  All: createContext<{ leftTabs: TabType[]; rightTabs: TabType[] }>({
    leftTabs: [],
    rightTabs: [],
  }),
  CurrentLeft: createContext<{ tab: TabType | null }>({
    tab: null,
  }),
  CurrentRight: createContext<{ tab: TabType | null }>({
    tab: null,
  }),
};
