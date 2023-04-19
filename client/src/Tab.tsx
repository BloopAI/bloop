import React, { useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Settings from './components/Settings';
import { RepoType, UITabType } from './types/general';
import { DeviceContextType } from './context/deviceContext';
import { RepositoriesContext } from './context/repositoriesContext';
import './index.css';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import ReportBugModal from './components/ReportBugModal';
import { UIContextProvider } from './context/providers/UiContextProvider';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import { AppNavigationProvider } from './hooks/useAppNavigation';
import ContentContainer from './pages';
import { SearchContextProvider } from './context/providers/SearchContextProvider';
import { ChatContextProvider } from './context/providers/ChatContextProvider';

type Props = {
  deviceContextValue: DeviceContextType;
  isActive: boolean;
  tab: UITabType;
};

function Tab({ deviceContextValue, isActive, tab }: Props) {
  const [repositories, setRepositories] = useState<RepoType[] | undefined>();

  const reposContextValue = useMemo(
    () => ({
      repositories,
      setRepositories,
      localSyncError: false,
      githubSyncError: false,
    }),
    [repositories],
  );

  return (
    <div className={`${isActive ? '' : 'hidden'} `}>
      <BrowserRouter>
        <AnalyticsContextProvider
          forceAnalytics={deviceContextValue.forceAnalytics}
          isSelfServe={deviceContextValue.isSelfServe}
          envConfig={deviceContextValue.envConfig}
        >
          <DeviceContextProvider deviceContextValue={deviceContextValue}>
            <UIContextProvider tab={tab}>
              <AppNavigationProvider>
                <SearchContextProvider initialSearchHistory={tab.searchHistory}>
                  <RepositoriesContext.Provider value={reposContextValue}>
                    <ChatContextProvider>
                      <Routes>
                        <Route
                          path="*"
                          element={<ContentContainer tab={tab} />}
                        />
                      </Routes>
                      <Settings />
                      <ReportBugModal />
                    </ChatContextProvider>
                  </RepositoriesContext.Provider>
                </SearchContextProvider>
              </AppNavigationProvider>
            </UIContextProvider>
          </DeviceContextProvider>
        </AnalyticsContextProvider>
      </BrowserRouter>
    </div>
  );
}

export default Tab;
