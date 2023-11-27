import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { DeviceContextType } from '../context/deviceContext';
import '../index.css';
import { DeviceContextProvider } from '../context/providers/DeviceContextProvider';
import { RepoSource } from '../types';
import { GeneralUiContextProvider } from '../context/providers/GeneralUiContextProvider';
import ReportBugModal from '../components/ReportBugModal';
import ErrorFallback from '../components/ErrorFallback';
import { useComponentWillMount } from '../hooks/useComponentWillMount';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { AnalyticsContextProvider } from '../context/providers/AnalyticsContextProvider';
import { PersonalQuotaContextProvider } from '../context/providers/PersonalQuotaContextProvider';
import UpgradePopup from './components/UpgradePopup';
import WaitingUpgradePopup from './components/UpgradePopup/WaitingUpgradePopup';
import CloudFeaturePopup from './components/CloudFeaturePopup';
import {
  NavigationItem,
  RepoProvider,
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
import { RepositoriesContext } from './context/repositoriesContext';
import { buildURLPart, getNavItemFromURL } from './utils/navigationUtils';
import PromptGuidePopup from './components/PromptGuidePopup';
import Onboarding from './pages/Onboarding';
import NavBar from './components/NavBar';
import StudioGuidePopup from './components/StudioGuidePopup';
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
          <GeneralUiContextProvider activeTab={activeTab}>
            <PersonalQuotaContextProvider>
              <NavBar activeTab={activeTab} />
              <div className="mt-8" />
              <ReportBugModal />
              <PromptGuidePopup />
              <StudioGuidePopup />
              <Onboarding activeTab={activeTab} />
              <CloudFeaturePopup />
              <UpgradePopup />
              <WaitingUpgradePopup />
            </PersonalQuotaContextProvider>
          </GeneralUiContextProvider>
        </RepositoriesContext.Provider>
      </AnalyticsContextProvider>
    </DeviceContextProvider>
  );
}

export default Sentry.withErrorBoundary(App, {
  fallback: (props) => <ErrorFallback {...props} />,
});
