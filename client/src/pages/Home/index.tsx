import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import NavBar from '../../components/NavBar';
import StatusBar from '../../components/StatusBar';
import ListNavigation from '../../components/IdeNavigation/ListNavigation';
import { GitHubLogo, List, Repository } from '../../icons';
import ErrorFallback from '../../components/ErrorFallback';
import ReposSection from './ReposSection';

type Props = {
  emptyRepos?: boolean; // only for storybook
};

const mainContainerStyle = { height: 'calc(100vh - 8rem)' };

const listNavigationItems = [
  { title: 'All', icon: <List /> },
  { title: 'Local repos', icon: <Repository /> },
  { title: 'GitHub repos', icon: <GitHubLogo /> },
];

const HomePage = ({ emptyRepos }: Props) => {
  const [filter, setFilter] = useState(0);
  return (
    <div className="text-gray-200">
      <NavBar userSigned />
      <div
        className={`flex mt-16 w-screen overflow-auto relative`}
        style={mainContainerStyle}
      >
        <div className="w-90 text-gray-300 border-r border-gray-800 flex-shrink-0 h-full">
          <ListNavigation
            title=" "
            items={listNavigationItems}
            setSelected={setFilter}
            selected={filter}
          />
        </div>
        <ReposSection filter={filter} emptyRepos={emptyRepos} />
      </div>
      <StatusBar />
    </div>
  );
};

export default Sentry.withErrorBoundary(HomePage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
