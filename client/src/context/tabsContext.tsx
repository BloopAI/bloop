import { createContext, Dispatch, SetStateAction } from 'react';
import {
  ChatTabType,
  DocTabType,
  FileTabType,
  StudioTabType,
  TabType,
} from '../types/general';

type HandlersContextType = {
  openNewTab: (
    data:
      | Omit<FileTabType, 'key'>
      | Omit<ChatTabType, 'key'>
      | Omit<StudioTabType, 'key'>
      | Omit<DocTabType, 'key'>,
    forceSide?: 'left' | 'right',
  ) => void;
  closeTab: (key: string, side: 'left' | 'right') => void;
  setActiveLeftTab: Dispatch<SetStateAction<TabType | null>>;
  setActiveRightTab: Dispatch<SetStateAction<TabType | null>>;
  setFocusedPanel: (panel: 'left' | 'right') => void;
  setLeftTabs: Dispatch<SetStateAction<TabType[]>>;
  setRightTabs: Dispatch<SetStateAction<TabType[]>>;
  updateTabProperty: <
    T extends ChatTabType | FileTabType | StudioTabType | DocTabType,
    K extends keyof T,
  >(
    tabKey: string,
    objectKey: K,
    newValue: T[K],
    side: 'left' | 'right',
  ) => void;
};

export const TabsContext = {
  Handlers: createContext<HandlersContextType>({
    openNewTab: () => {},
    closeTab: (key: string, side: 'left' | 'right') => {},
    setActiveLeftTab: () => {},
    setActiveRightTab: () => {},
    setFocusedPanel: (panel: 'left' | 'right') => {},
    setLeftTabs: () => {},
    setRightTabs: () => {},
    updateTabProperty: () => {},
  }),
  All: createContext<{
    leftTabs: TabType[];
    rightTabs: TabType[];
    focusedPanel: 'left' | 'right';
  }>({
    leftTabs: [],
    rightTabs: [],
    focusedPanel: 'left',
  }),
  CurrentLeft: createContext<{ tab: TabType | null }>({
    tab: null,
  }),
  CurrentRight: createContext<{ tab: TabType | null }>({
    tab: null,
  }),
};
