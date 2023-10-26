import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { DeviceContextType } from './context/deviceContext';
import './index.css';
import RepoTab from './pages/RepoTab';
import { TabsContext } from './context/tabsContext';
import {
  NavigationItem,
  RepoProvider,
  RepoTabType,
  RepoType,
  StudioTabType,
  TabType,
  UITabType,
} from './types/general';
import {
  LAST_ACTIVE_TAB_KEY,
  saveJsonToStorage,
  savePlainToStorage,
  TABS_KEY,
} from './services/storage';
import { getRepos, initApi } from './services/api';
import { useComponentWillMount } from './hooks/useComponentWillMount';
import { RepoSource } from './types';
import { RepositoriesContext } from './context/repositoriesContext';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import { buildURLPart, getNavItemFromURL } from './utils/navigationUtils';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import useKeyboardNavigation from './hooks/useKeyboardNavigation';
import StudioTab from './pages/StudioTab';
import HomeTab from './pages/HomeTab';
import Settings from './components/Settings';
import ReportBugModal from './components/ReportBugModal';
import { GeneralUiContextProvider } from './context/providers/GeneralUiContextProvider';
import PromptGuidePopup from './components/PromptGuidePopup';
import Onboarding from './pages/Onboarding';
import NavBar from './components/NavBar';
import StatusBar from './components/StatusBar';
import CloudFeaturePopup from './components/CloudFeaturePopup';
import ErrorFallback from './components/ErrorFallback';
import { PersonalQuotaContextProvider } from './context/providers/PersonalQuotaContextProvider';
import UpgradePopup from './components/UpgradePopup';
import StudioGuidePopup from './components/StudioGuidePopup';
import WaitingUpgradePopup from './components/UpgradePopup/WaitingUpgradePopup';
import { polling } from './utils/requestUtils';

type Props = {
  deviceContextValue: DeviceContextType;
};

function App({ deviceContextValue }: Props) {
  useComponentWillMount(() =>
    initApi(deviceContextValue.apiUrl, deviceContextValue.isSelfServe),
  );

  const [tabs, setTabs] = useState<UITabType[]>([
    {
      key: 'initial',
      name: 'Home',
      type: TabType.HOME,
    },
  ]);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('initial');
  const [repositories, setRepositories] = useState<RepoType[] | undefined>();
  const [isLoading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [isTransitioning, startTransition] = useTransition();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const tab = tabs.find((t) => t.key === activeTab);
    if (tab && tab.type === TabType.HOME) {
      navigate('/');
      return;
    } else if (tab && tab.type === TabType.REPO) {
      const lastNav = tab.navigationHistory[tab.navigationHistory.length - 1];
      navigate(
        `/${encodeURIComponent(tab.repoRef)}/${encodeURIComponent(
          tab.branch || 'all',
        )}/${lastNav ? buildURLPart(lastNav) : ''}`,
      );
    } else if (tab && tab.type === TabType.STUDIO) {
      navigate(
        `/studio/${encodeURIComponent(tab.key)}/${encodeURIComponent(
          tab.name,
        )}`,
      );
    }
  }, [activeTab, tabs]);

  const handleAddRepoTab = useCallback(
    (
      repoRef: string,
      repoName: string,
      name: string,
      source: RepoSource,
      branch?: string | null,
      navHistory?: NavigationItem[],
    ) => {
      const newTab = {
        key: repoRef + '#' + Date.now(),
        name,
        repoName,
        repoRef,
        source,
        branch,
        navigationHistory: navHistory || [],
        type: TabType.REPO,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(newTab.key);
    },
    [],
  );

  const handleAddStudioTab = useCallback((name: string, id: string) => {
    const newTab: StudioTabType = {
      key: id.toString(),
      name,
      type: TabType.STUDIO,
    };
    setTabs((prev: UITabType[]) => {
      const existing = prev.find((t) => t.key === newTab.key);
      if (existing) {
        setActiveTab(existing.key);
        return prev;
      }
      return [...prev, newTab];
    });
    setActiveTab(newTab.key);
  }, []);

  useEffect(() => {
    if (location.pathname === '/') {
      setLoading(false);
      return;
    }
    if (isLoading && repositories?.length) {
      const firstPart = decodeURIComponent(
        location.pathname.slice(1).split('/')[0],
      );
      const repo = repositories.find((r) => r.ref === firstPart);
      if (firstPart === 'studio') {
        handleAddStudioTab(
          decodeURIComponent(location.pathname.slice(1).split('/')[2]),
          decodeURIComponent(location.pathname.slice(1).split('/')[1]),
        );
      } else if (repo) {
        const urlBranch = decodeURIComponent(location.pathname.split('/')[2]);
        handleAddRepoTab(
          repo.ref,
          repo.provider === RepoProvider.GitHub ? repo.ref : repo.name,
          repo.name,
          repo.provider === RepoProvider.GitHub
            ? RepoSource.GH
            : RepoSource.LOCAL,
          urlBranch === 'all' ? null : urlBranch,
          getNavItemFromURL(
            location,
            repo.provider === RepoProvider.GitHub ? repo.ref : repo.name,
          ),
        );
      }
      setLoading(false);
    }
  }, [repositories, isLoading]);

  useEffect(() => {
    saveJsonToStorage(TABS_KEY, tabs);
  }, [tabs]);

  useEffect(() => {
    savePlainToStorage(LAST_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!tabs.find((t) => t.key === activeTab)) {
      setActiveTab('initial');
    }
  }, [activeTab, tabs]);

  const handleRemoveTab = useCallback(
    (tabKey: string) => {
      setActiveTab((prev) => {
        const prevIndex = tabs.findIndex((t) => t.key === prev);
        if (tabKey === prev) {
          return prevIndex > 0
            ? tabs[prevIndex - 1].key
            : tabs[prevIndex + 1].key;
        }
        return prev;
      });
      setTabs((prev) => prev.filter((t) => t.key !== tabKey));
    },
    [tabs],
  );

  const updateTabNavHistory = useCallback(
    (tabKey: string, history: (prev: NavigationItem[]) => NavigationItem[]) => {
      setTabs((prev) => {
        const tabIndex = prev.findIndex((t) => t.key === tabKey);
        if (tabIndex < 0 || prev[tabIndex].type !== TabType.REPO) {
          return prev;
        }
        const newTab = {
          ...prev[tabIndex],
          navigationHistory: history(
            (prev[tabIndex] as RepoTabType).navigationHistory,
          ),
        };
        const newTabs = [...prev];
        newTabs[tabIndex] = newTab;
        return newTabs;
      });
    },
    [],
  );

  const updateTabBranch = useCallback(
    (tabKey: string, branch: null | string) => {
      setTabs((prev) => {
        const tabIndex = prev.findIndex((t) => t.key === tabKey);
        if (tabIndex < 0) {
          return prev;
        }
        const newTab = {
          ...prev[tabIndex],
          branch,
        };
        const newTabs = [...prev];
        newTabs[tabIndex] = newTab;
        return newTabs;
      });
    },
    [],
  );

  const updateTabName = useCallback((tabKey: string, name: string) => {
    setTabs((prev) => {
      const tabIndex = prev.findIndex((t) => t.key === tabKey);
      if (tabIndex < 0) {
        return prev;
      }
      const newTab = {
        ...prev[tabIndex],
        name,
      };
      const newTabs = [...prev];
      newTabs[tabIndex] = newTab;
      return newTabs;
    });
  }, []);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const num = Number(e.key);
        if (Object.keys(tabs).includes((num - 1).toString())) {
          const newTab = tabs[num - 1]?.key;
          if (newTab) {
            e.preventDefault();
            setActiveTab(newTab);
          }
        } else if (e.key === 'w' && activeTab !== 'initial') {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveTab(activeTab);
          return true;
        }
      }
    },
    [tabs, activeTab],
  );
  useKeyboardNavigation(handleKeyEvent);

  const handleChangeActiveTab = useCallback((t: string) => {
    startTransition(() => {
      setActiveTab(t);
    });
  }, []);

  const handleReorderTabs = useCallback((newTabs: UITabType[]) => {
    setTabs((prev) => {
      return [prev[0], ...newTabs];
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      tabs,
      handleAddRepoTab,
      handleAddStudioTab,
      handleRemoveTab,
      setActiveTab: handleChangeActiveTab,
      updateTabNavHistory,
      updateTabBranch,
      updateTabName,
      handleReorderTabs,
    }),
    [
      tabs,
      handleAddRepoTab,
      handleAddStudioTab,
      handleRemoveTab,
      updateTabNavHistory,
      updateTabBranch,
      updateTabName,
      handleReorderTabs,
    ],
  );

  const fetchRepos = useCallback(() => {
    return getRepos().then((data) => {
      const list = data?.list?.sort((a, b) => (a.name < b.name ? -1 : 1)) || [];
      setRepositories((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(list)) {
          return prev;
        }
        return list;
      });
    });
  }, []);

  useEffect(() => {
    const intervalId = polling(fetchRepos, 5000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const reposContextValue = useMemo(
    () => ({
      repositories,
      setRepositories,
      localSyncError: false,
      githubSyncError: false,
      fetchRepos,
    }),
    [repositories],
  );

  return (
    <DeviceContextProvider deviceContextValue={deviceContextValue}>
      <AnalyticsContextProvider
        forceAnalytics={deviceContextValue.forceAnalytics}
        isSelfServe={deviceContextValue.isSelfServe}
        envConfig={deviceContextValue.envConfig}
      >
        <RepositoriesContext.Provider value={reposContextValue}>
          <TabsContext.Provider value={contextValue}>
            <GeneralUiContextProvider activeTab={activeTab}>
              <PersonalQuotaContextProvider>
                <NavBar activeTab={activeTab} />
                <div className="mt-8" />
                {tabs.map((t) =>
                  t.type === TabType.STUDIO ? (
                    <StudioTab
                      key={t.key}
                      isActive={t.key === activeTab}
                      tab={t}
                      isTransitioning={isTransitioning}
                    />
                  ) : t.type === TabType.REPO ? (
                    <RepoTab
                      key={t.key}
                      isActive={t.key === activeTab}
                      tab={t}
                      isTransitioning={isTransitioning}
                    />
                  ) : (
                    <HomeTab
                      key={t.key}
                      isActive={t.key === activeTab}
                      tab={t}
                      isTransitioning={isTransitioning}
                    />
                  ),
                )}
                <Settings />
                <ReportBugModal />
                <PromptGuidePopup />
                <StudioGuidePopup />
                <Onboarding activeTab={activeTab} />
                <StatusBar />
                <CloudFeaturePopup />
                <UpgradePopup />
                <WaitingUpgradePopup />
              </PersonalQuotaContextProvider>
            </GeneralUiContextProvider>
          </TabsContext.Provider>
        </RepositoriesContext.Provider>
      </AnalyticsContextProvider>
    </DeviceContextProvider>
  );
}

export default Sentry.withErrorBoundary(App, {
  fallback: (props) => <ErrorFallback {...props} />,
});
