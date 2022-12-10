import React, { useCallback, useContext, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import NavBar from '../../components/NavBar';
import StatusBar from '../../components/StatusBar';
import ListNavigation from '../../components/IdeNavigation/ListNavigation';
import { GitHubLogo, List, Repository } from '../../icons';
import {
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  savePlainToStorage,
  SESSION_ID_KEY,
} from '../../services/storage';
import { SearchContext } from '../../context/searchContext';
import ErrorFallback from '../../components/ErrorFallback';
import Onboarding from './Onboarding';
import ReposSection from './ReposSection';
import TelemetryPopup from './TelemetryPopup';

type Props = {
  emptyRepos?: boolean; // only for storybook
};

const mainContainerStyle = { height: 'calc(100vh - 8rem)' };

const listNavigationItems = [
  { title: 'All', icon: <List /> },
  { title: 'Local repos', icon: <Repository /> },
  { title: 'GitHub repos', icon: <GitHubLogo /> },
];

let onboardingFinished = false;

const HomePage = ({ emptyRepos }: Props) => {
  const [shouldShowWelcome, setShouldShowWelcome] = useState(
    !getPlainFromStorage(ONBOARDING_DONE_KEY),
  );
  const [shouldShowTelemetry, setShouldShowTelemetry] = useState(false);
  const [filter, setFilter] = useState(0);
  const { setInputValue } = useContext(SearchContext);

  const closeTelemetry = useCallback(() => {
    setShouldShowTelemetry(false);
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_ONBOARDING) {
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

  const closeOnboarding = useCallback(() => {
    setShouldShowWelcome(false);
    onboardingFinished = true; // to avoid showing onboarding twice per session when using VITE_ONBOARDING=true
    savePlainToStorage(ONBOARDING_DONE_KEY, 'true');
    setTimeout(() => setShouldShowTelemetry(true), 2000);
  }, []);

  return (
    <div className="text-gray-200">
      <NavBar userSigned isSkeleton={shouldShowWelcome} />
      <div
        className={`flex ${
          shouldShowWelcome ? 'justify-center items-start' : ''
        } mt-16 w-screen overflow-auto relative`}
        style={mainContainerStyle}
      >
        {shouldShowWelcome ? (
          <Onboarding onFinish={closeOnboarding} />
        ) : (
          <>
            <TelemetryPopup
              onClose={closeTelemetry}
              visible={shouldShowTelemetry}
            />
            <div className="w-90 text-gray-300 border-r border-gray-800 flex-shrink-0 h-full">
              <ListNavigation
                title=" "
                items={listNavigationItems}
                setSelected={setFilter}
                selected={filter}
              />
            </div>
            <ReposSection filter={filter} emptyRepos={emptyRepos} />
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
};

export default Sentry.withErrorBoundary(HomePage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
