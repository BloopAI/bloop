import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/Home';
import Settings from './components/Settings';
import { RepoType } from './types/general';
import { DeviceContextType } from './context/deviceContext';
import { RepositoriesContext } from './context/repositoriesContext';
import './index.css';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import ReportBugModal from './components/ReportBugModal';
import { UIContextProvider } from './context/providers/UiContextProvider';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';
import { AppNavigationProvider } from './hooks/useAppNavigation';
import SearchPage from './pages/Search';
import { SearchContextProvider } from './context/providers/SearchContextProvider';
import { initApi } from './services/api';
import { useComponentWillMount } from './hooks/useComponentWillMount';

type Props = {
  deviceContextValue: DeviceContextType;
};

function App({ deviceContextValue }: Props) {
  useComponentWillMount(() => initApi(deviceContextValue.apiUrl));

  const [repositories, setRepositories] = useState<RepoType[]>([]);

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
    <BrowserRouter>
      <AnalyticsContextProvider
        deviceId={deviceContextValue.deviceId}
        forceAnalytics={deviceContextValue.forceAnalytics}
      >
        <DeviceContextProvider deviceContextValue={deviceContextValue}>
          <UIContextProvider>
            <AppNavigationProvider>
              <SearchContextProvider>
                <RepositoriesContext.Provider value={reposContextValue}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/search" element={<SearchPage />} />
                  </Routes>
                  <Settings />
                  <ReportBugModal />
                </RepositoriesContext.Provider>
              </SearchContextProvider>
            </AppNavigationProvider>
          </UIContextProvider>
        </DeviceContextProvider>
      </AnalyticsContextProvider>
    </BrowserRouter>
  );
}

export default App;
