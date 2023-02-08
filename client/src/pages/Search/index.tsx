import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { SearchContext } from '../../context/searchContext';
import { useSearch } from '../../hooks/useSearch';
import {
  DirectorySearchResponse,
  GeneralSearchResponse,
  NLSearchResponse,
  SearchResponse,
} from '../../types/api';
import RepositoryPage from '../Repository';
import PageTemplate from '../../components/PageTemplate';
import ErrorFallback from '../../components/ErrorFallback';
import useAppNavigation from '../../hooks/useAppNavigation';
import { buildRepoQuery } from '../../utils';
import ResultsPage from '../Results';
import ViewResult from '../ResultFull';
import { SearchType } from '../../types/general';
import NLResults from '../NLResults';
import NoResults from '../Results/NoResults';
import HomePage from '../Home';
import { TabsContext } from '../../context/tabsContext';
import { getRepos } from '../../services/api';
import {
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  savePlainToStorage,
  SESSION_ID_KEY,
} from '../../services/storage';
import { DeviceContext } from '../../context/deviceContext';
import StatusBar from '../../components/StatusBar';
import Onboarding from '../Home/Onboarding';
import NavBar from '../../components/NavBar';

const mockQuerySuggestions = [
  'repo:cobra-ats  error:“no apples”',
  'error:“no apples”',
  'no apples',
  'repo:cobra-ats apples',
  'lang:tsx apples',
];

let onboardingFinished = false;

const SearchPage = () => {
  const { setInputValue, globalRegex, searchType, setSearchType } =
    useContext(SearchContext);
  const { isRepoManagementAllowed } = useContext(DeviceContext);
  const [shouldShowWelcome, setShouldShowWelcome] = useState(
    !getPlainFromStorage(ONBOARDING_DONE_KEY),
  );
  const { searchQuery, data, loading } = useSearch<SearchResponse>();
  const {
    searchQuery: nlSearchQuery,
    data: nlData,
    loading: nlLoading,
  } = useSearch<NLSearchResponse>();
  const { updateCurrentTabName } = useContext(TabsContext);

  const { navigatedItem, query } = useAppNavigation();

  const closeOnboarding = useCallback(() => {
    setShouldShowWelcome(false);
    onboardingFinished = true; // to avoid showing onboarding twice per session when using VITE_ONBOARDING=true
    savePlainToStorage(ONBOARDING_DONE_KEY, 'true');
  }, []);

  useEffect(() => {
    if (import.meta.env.ONBOARDING) {
      if (
        getPlainFromStorage(SESSION_ID_KEY) !==
        window.__APP_SESSION__.toString()
      ) {
        localStorage.removeItem(ONBOARDING_DONE_KEY);
        savePlainToStorage(SESSION_ID_KEY, window.__APP_SESSION__.toString());
        setShouldShowWelcome(true);
      }
    }
    setInputValue('');
  }, []);

  useEffect(() => {
    getRepos()
      .then(() => {
        closeOnboarding();
      })
      .catch(() => {
        setShouldShowWelcome(true);
      });
  }, []);

  useEffect(() => {
    if (!navigatedItem) {
      updateCurrentTabName('Home');
      return;
    }
    if (navigatedItem.searchType !== undefined) {
      setSearchType(navigatedItem.searchType);
    }

    setInputValue(query);

    switch (navigatedItem.type) {
      case 'repo':
      case 'full-result':
        updateCurrentTabName(
          navigatedItem.type === 'repo'
            ? navigatedItem.repo!
            : navigatedItem.path!,
        );
        searchQuery(
          buildRepoQuery(navigatedItem.repo, navigatedItem.path),
          0,
          false,
          SearchType.REGEX,
        );
        break;
      case 'home':
        updateCurrentTabName('Home');
        break;
      default:
        updateCurrentTabName(navigatedItem.query!);
        if ((navigatedItem.searchType ?? searchType) === SearchType.NL) {
          nlSearchQuery(navigatedItem.query!, 0, false, SearchType.NL);
        } else {
          searchQuery(navigatedItem.query!, navigatedItem.page, globalRegex);
        }
    }
  }, [navigatedItem]);

  const handleRetry = useCallback(() => {
    nlSearchQuery(navigatedItem!.query!);
  }, [navigatedItem?.query]);

  const getRenderPage = useCallback(() => {
    let renderPage:
      | 'results'
      | 'repo'
      | 'full-result'
      | 'nl-result'
      | 'no-results'
      | 'home';
    if (!navigatedItem || navigatedItem.type === 'home') {
      return 'home';
    }
    if (
      (navigatedItem?.searchType === SearchType.NL &&
        !nlData?.snippets?.length &&
        !nlLoading) ||
      (navigatedItem?.searchType === SearchType.REGEX &&
        !data?.data[0] &&
        !loading)
    ) {
      return 'no-results';
    }
    const resultType =
      navigatedItem?.searchType === SearchType.NL ? 'nl' : data?.data[0].kind;
    switch (resultType) {
      case 'dir':
        renderPage = 'repo';
        break;
      case 'file':
        renderPage = 'full-result';
        break;
      case 'nl':
        renderPage = 'nl-result';
        break;
      default:
        renderPage = 'results';
    }
    return renderPage;
  }, [navigatedItem, data, loading, nlData, nlLoading]);

  const renderedPage = useMemo(() => {
    let renderPage = getRenderPage();
    switch (renderPage) {
      case 'results':
        return (
          <ResultsPage
            resultsData={data as GeneralSearchResponse}
            loading={loading}
          />
        );
      case 'no-results':
        return <NoResults suggestions={mockQuerySuggestions} />;
      case 'repo':
        return (
          <RepositoryPage repositoryData={data as DirectorySearchResponse} />
        );
      case 'full-result':
        return <ViewResult data={data} />;
      case 'nl-result':
        return (
          <NLResults
            loading={nlLoading}
            resultsData={nlData}
            handleRetry={handleRetry}
          />
        );
      default:
        return <HomePage />;
    }
  }, [data, loading, nlLoading, nlData, handleRetry, navigatedItem]);

  return shouldShowWelcome ? (
    <div className="text-gray-200">
      <NavBar userSigned isSkeleton />
      <div
        className={`flex justify-center items-start mt-16 w-screen overflow-auto relative h-[calc(100vh-8rem)]`}
      >
        <Onboarding onFinish={closeOnboarding} />
      </div>
      <StatusBar />
    </div>
  ) : (
    <PageTemplate>{renderedPage}</PageTemplate>
  );
};

export default Sentry.withErrorBoundary(SearchPage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
