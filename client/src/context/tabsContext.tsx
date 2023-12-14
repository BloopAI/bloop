import { createContext, Dispatch, SetStateAction } from 'react';
import { TabType, TabTypesEnum } from '../types/general';

type HandlersContextType = {
  openNewTab: (
    data:
      | {
          type: TabTypesEnum.FILE;
          path: string;
          repoRef: string;
          branch?: string | null;
          scrollToLine?: string;
          tokenRange?: string;
        }
      | {
          type: TabTypesEnum.CHAT;
          conversationId?: string;
          title?: string;
          initialQuery?: {
            path: string;
            lines: [number, number];
            repoRef: string;
            branch?: string | null;
          };
        },
    forceSide?: 'left' | 'right',
  ) => void;
  closeTab: (key: string, side: 'left' | 'right') => void;
  setActiveLeftTab: Dispatch<SetStateAction<TabType | null>>;
  setActiveRightTab: Dispatch<SetStateAction<TabType | null>>;
  setFocusedPanel: (panel: 'left' | 'right') => void;
  setLeftTabs: Dispatch<SetStateAction<TabType[]>>;
  setRightTabs: Dispatch<SetStateAction<TabType[]>>;
  updateTabTitle: (
    tabKey: string,
    newTitle: string,
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
    updateTabTitle: () => {},
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
