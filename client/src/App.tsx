import React, { useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SearchContext } from './context/searchContext';
import ResultsPage from './pages/Results';
import ViewResult from './pages/ViewResult';
import HomePage from './pages/Home';
import Settings from './components/Settings';
import { FilterType, RepoType } from './types/general';
import { DeviceContextType } from './context/deviceContext';
import { RepositoriesContext } from './context/repositoriesContext';
import { getJsonFromStorage, SEARCH_HISTORY_KEY } from './services/storage';
import './index.css';
import { AnalyticsContextProvider } from './context/providers/AnalyticsContextProvider';
import ReportBugModal from './components/ReportBugModal';
import { UIContextProvider } from './context/providers/UiContextProvider';
import { DeviceContextProvider } from './context/providers/DeviceContextProvider';

type Props = {
  deviceContextValue: DeviceContextType;
};

function App({ deviceContextValue }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [filters, setFilters] = useState<FilterType[]>([]);
  const [repositories, setRepositories] = useState<RepoType[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(
    getJsonFromStorage(SEARCH_HISTORY_KEY) || [],
  );
  const [lastQueryTime, setLastQueryTime] = useState(3);
  const [globalRegex, setGlobalRegex] = useState(false);

  // useRouterSate(router);
  const searchContextValue = useMemo(
    () => ({
      inputValue,
      setInputValue,
      searchHistory,
      setSearchHistory,
      filters,
      setFilters,
      lastQueryTime,
      setLastQueryTime,
      globalRegex,
      setGlobalRegex,
    }),
    [inputValue, filters, searchHistory, lastQueryTime, globalRegex],
  );

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
      <AnalyticsContextProvider>
        <DeviceContextProvider deviceContextValue={deviceContextValue}>
          <UIContextProvider>
            <SearchContext.Provider value={searchContextValue}>
              <RepositoriesContext.Provider value={reposContextValue}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/result/file" element={<ViewResult />} />
                </Routes>
                <Settings />
                <ReportBugModal />
              </RepositoriesContext.Provider>
            </SearchContext.Provider>
          </UIContextProvider>
        </DeviceContextProvider>
      </AnalyticsContextProvider>
    </BrowserRouter>
  );
}

export default App;
