import React, { useCallback, useContext, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
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
import { DeviceContext } from '../../context/deviceContext';
import Onboarding from './Onboarding';
import ReposSection from './ReposSection';

type Props = {
  emptyRepos?: boolean; // only for storybook
};

const listNavigationItems = [
  { title: 'All', icon: <List /> },
  { title: 'Local repos', icon: <Repository /> },
  { title: 'GitHub repos', icon: <GitHubLogo /> },
];

const HomePage = ({ emptyRepos }: Props) => {
  const [filter, setFilter] = useState(0);

  return (
    <>
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
  );
};

export default Sentry.withErrorBoundary(HomePage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
