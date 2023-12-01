import { memo, PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { TabsContext } from '../tabsContext';
import { FileTabType } from '../../types/general';

type Props = {};

const TabsContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [tabs, setTabs] = useState<FileTabType[]>([]);
  const [activeTab, setActiveTab] = useState<FileTabType | null>(null);

  const openNewTab = useCallback((path: string, repoName: string) => {
    setTabs((prev) => {
      const newTab = { path, repoName, key: `${repoName}-${path}` };
      setActiveTab(newTab);
      if (!prev.find((t) => t.key === newTab.key)) {
        return [...prev, newTab];
      }
      return prev;
    });
  }, []);

  const closeTab = useCallback((key: string) => {
    setTabs((prevTabs) => {
      setActiveTab((prev) => {
        const prevIndex = prev
          ? prevTabs.findIndex((t) => t.key === prev.key)
          : -1;
        if (key === prev?.key) {
          return prevIndex > 0 ? tabs[prevIndex - 1] : tabs[prevIndex + 1];
        }
        return prev;
      });
      return prevTabs.filter((t) => t.key !== key);
    });
  }, []);

  const handlersContextValue = useMemo(
    () => ({
      closeTab,
      openNewTab,
    }),
    [closeTab, openNewTab],
  );

  const allContextValue = useMemo(
    () => ({
      tabs,
    }),
    [tabs],
  );

  const currentContextValue = useMemo(
    () => ({
      tab: activeTab,
    }),
    [activeTab],
  );

  return (
    <TabsContext.Handlers.Provider value={handlersContextValue}>
      <TabsContext.All.Provider value={allContextValue}>
        <TabsContext.Current.Provider value={currentContextValue}>
          {children}
        </TabsContext.Current.Provider>
      </TabsContext.All.Provider>
    </TabsContext.Handlers.Provider>
  );
};

export default memo(TabsContextProvider);
