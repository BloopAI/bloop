import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { HardDrive, Lock } from '../../icons';
import Button from '../Button';
import SkeletonItem from '../SkeletonItem';
import { RepoUi } from '../../types/general';
import { syncRepo } from '../../services/api';

type Props = {
  repos: RepoUi[];
  source: 'local' | 'GitHub';
  isLoading?: boolean;
  filter?: string;
  onSync?: () => void;
};

const listItemClassName =
  'bg-gray-900 border-b border-l border-r first:border-t first:rounded-t-md last:border-b last:rounded-b-md border-gray-800 pl-3 p-1.5 body-s group h-11';

const RepoList = ({ repos, source, isLoading, filter, onSync }: Props) => {
  const [filteredRepos, setFilteredRepos] = useState(repos);

  useEffect(() => {
    if (filter) {
      setFilteredRepos(repos.filter((r) => r.name.includes(filter)));
    } else {
      setFilteredRepos(repos);
    }
  }, [filter, repos]);

  const handleSync = useCallback((repoRef: string) => {
    syncRepo(repoRef);
    onSync?.();
  }, []);

  return (
    <div className={`fade-bottom relative`}>
      <ul className="bg-gray-900 shadow-light overflow-y-auto pb-6">
        {!isLoading ? (
          !filteredRepos.length ? (
            <div className="flex flex-col gap-2 py-6 text-center">
              <p className="body-s text-gray-300">No results...</p>
              <p className="text-gray-500 caption">
                Nothing matched your search. Try a different combination!
              </p>
            </div>
          ) : (
            filteredRepos.map((repo, i) => (
              <Fragment key={repo.name + i}>
                {i === 0 ||
                (filteredRepos[i - 1] &&
                  filteredRepos[i - 1].folderName !== repo.folderName) ? (
                  <span
                    className={`bg-gray-800 text-sm w-full py-2 px-4 block ${
                      i === 0 ? 'rounded-t-md' : ''
                    }`}
                  >
                    {repo.folderName}
                  </span>
                ) : (
                  ''
                )}
                <li className={listItemClassName} title={repo.name}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="py-1.5 flex items-center gap-2 overflow-hidden">
                      {source === 'local' ? <HardDrive /> : <Lock />}
                      <span className="whitespace-nowrap">
                        {repo.shortName}
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="small"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        handleSync(repo.ref);
                      }}
                    >
                      Sync
                    </Button>
                  </div>
                </li>
              </Fragment>
            ))
          )
        ) : (
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <li key={i} className={`${listItemClassName} flex items-center`}>
              <span className="h-4 w-full inline-block">
                <SkeletonItem />
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default RepoList;
