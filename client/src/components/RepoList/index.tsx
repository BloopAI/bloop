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
  onFolderChange?: () => void;
};

const listItemClassName =
  'bg-bg-sub pl-3 p-1.5 body-s group h-11 border-b border-x border-bg-border first:border-t first:rounded-tl-md first:rounded-tr-md  last:rounded-bl-md last:rounded-br-md';

const RepoList = ({
  repos,
  source,
  isLoading,
  filter,
  onSync,
  onFolderChange,
}: Props) => {
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
    <div className={`relative`}>
      <ul className="overflow-auto pb-6 rounded-md">
        {!isLoading ? (
          !filteredRepos.length ? (
            <div className="flex flex-col gap-2 py-6 text-center">
              <p className="body-s text-label-title">No results...</p>
              <p className="text-label-base caption">
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
                    className={`bg-bg-base border-x border-b first:border-t border-bg-border text-sm w-full py-2 px-4 flex items-center justify-between ${
                      i === 0 ? 'rounded-t-md' : ''
                    }`}
                  >
                    {repo.folderName}
                    {onFolderChange && i === 0 && (
                      <button
                        className="caption text-bg-main"
                        onClick={onFolderChange}
                      >
                        Change folder
                      </button>
                    )}
                  </span>
                ) : (
                  ''
                )}
                <li className={listItemClassName} title={repo.name}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="py-1.5 flex items-center gap-2 overflow-hidden text-label-base group-hover:text-label-title">
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
