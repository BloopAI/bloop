import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import ErrorFallback from '../../components/ErrorFallback';
import AddRepos from './AddRepos';
import ReposSection from './ReposSection';
import AddRepoCard from './AddRepoCard';

const HomePage = () => {
  const [isAddReposOpen, setAddReposOpen] = useState<
    null | 'local' | 'github' | 'public'
  >(null);
  return (
    <div className="w-full flex flex-col mx-auto max-w-6.5xl">
      <div className="p-8 pb-0">
        <h4 className="mb-3">Add</h4>
        <div className="flex gap-3.5 items-center">
          <AddRepoCard type="github" onClick={setAddReposOpen} />
          <AddRepoCard type="public" onClick={setAddReposOpen} />
          <AddRepoCard type="local" onClick={setAddReposOpen} />
        </div>
      </div>
      <ReposSection />
      <AddRepos
        addRepos={isAddReposOpen}
        onClose={() => {
          setAddReposOpen(null);
        }}
      />
    </div>
  );
};

export default Sentry.withErrorBoundary(HomePage, {
  fallback: (props) => <ErrorFallback {...props} />,
});
