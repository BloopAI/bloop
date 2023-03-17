import { createContext } from 'react';
import { UITabType } from '../types/general';

type ContextType = {
  tabs: UITabType[];
  activeTab: string;
  handleAddTab: () => void;
  handleRemoveTab: (t: string) => void;
  setActiveTab: (t: string) => void;
  updateCurrentTabName: (n: string) => void;
};

export const TabsContext = createContext<ContextType>({
  tabs: [{ key: 'initial', name: 'Untitled search' }],
  activeTab: 'initial',
  handleAddTab: () => {},
  handleRemoveTab: () => {},
  setActiveTab: () => {},
  updateCurrentTabName: () => {},
});
