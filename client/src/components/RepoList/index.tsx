import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  CheckIcon,
  CodeStudioIcon,
  HardDrive,
  RepositoryFilled,
} from '../../icons';
import Button from '../Button';
import SkeletonItem from '../SkeletonItem';
import { RepoUi } from '../../types/general';
import { syncRepo } from '../../services/api';
import { CodeStudioType } from '../../types/api';

type StudioProps = {
  type: 'studio';
  items: CodeStudioType[];
};

type RepoProps = {
  type: 'local' | 'GitHub';
  items: RepoUi[];
  onFolderChange?: () => void;
};

type Props = {
  isLoading?: boolean;
  filter?: string;
  onSync?: (refOrId: string) => void;
  onFolderChange?: () => void;
  sortBy?: 'name' | 'last_updated';
} & (StudioProps | RepoProps);

const listItemClassName =
  'bg-bg-sub pl-3 p-1.5 body-s group-row h-11 border-b border-x border-bg-border first:border-t first:rounded-tl-md first:rounded-tr-md  last:rounded-bl-md last:rounded-br-md';

const sortRepos = (repos: RepoUi[], sortBy?: 'name' | 'last_updated') =>
  !sortBy || sortBy === 'name'
    ? repos
    : repos.sort((a, b) => (a.last_update > b.last_update ? -1 : 1));

const sortStudios = (
  items: CodeStudioType[],
  sortBy?: 'name' | 'last_updated',
) =>
  !sortBy
    ? items
    : sortBy === 'name'
    ? items.sort((a, b) => a.name.localeCompare(b.name))
    : items.sort((a, b) => (a.modified_at > b.modified_at ? -1 : 1));

const RepoList = ({
  items,
  type,
  isLoading,
  filter,
  onSync,
  onFolderChange,
  sortBy,
}: Props) => {
  useTranslation();
  const [filteredRepos, setFilteredRepos] = useState(
    type === 'studio' ? sortStudios(items, sortBy) : sortRepos(items, sortBy),
  );

  useEffect(() => {
    if (filter) {
      setFilteredRepos(
        type === 'studio'
          ? sortStudios(
              items.filter((r) => r.name.includes(filter)),
              sortBy,
            )
          : sortRepos(
              items.filter((r) => r.name.includes(filter)),
              sortBy,
            ),
      );
    } else {
      setFilteredRepos(
        type === 'studio'
          ? sortStudios(items, sortBy)
          : sortRepos(items, sortBy),
      );
    }
  }, [filter, items, sortBy, type]);

  const handleSync = useCallback(
    (repoRef: string) => {
      if (type !== 'studio') {
        syncRepo(repoRef);
      }
      onSync?.(repoRef);
    },
    [type],
  );

  return (
    <div className={`relative`}>
      <ul
        className={`overflow-auto ${items.length > 3 ? 'pb-6' : ''} rounded-md`}
      >
        {!isLoading ? (
          !filteredRepos.length ? (
            <div className="flex flex-col gap-2 py-6 text-center">
              <p className="body-s text-label-title">
                <Trans>No results...</Trans>
              </p>
              <p className="text-label-base caption">
                <Trans>
                  Nothing matched your search. Try a different combination!
                </Trans>
              </p>
            </div>
          ) : (
            filteredRepos.map((item, i) => (
              <Fragment key={item.name + i}>
                {type !== 'studio' &&
                sortBy !== 'last_updated' &&
                (i === 0 ||
                  (filteredRepos[i - 1] &&
                    (filteredRepos[i - 1] as RepoUi).folderName !==
                      (item as RepoUi).folderName)) ? (
                  <span
                    className={`bg-bg-base border-x border-b first:border-t border-bg-border text-sm w-full py-2 px-4 flex items-center justify-between ${
                      i === 0 ? 'rounded-t-md' : ''
                    }`}
                  >
                    {(item as RepoUi).folderName}
                    {onFolderChange && i === 0 && (
                      <button
                        className="caption text-bg-main"
                        onClick={onFolderChange}
                      >
                        <Trans>Change folder</Trans>
                      </button>
                    )}
                  </span>
                ) : (
                  ''
                )}
                <li className={listItemClassName} title={item.name}>
                  <div className="flex items-center justify-between w-full gap-2 h-full">
                    <div className="flex items-center gap-2 overflow-hidden text-label-base group-row-hover:text-label-title">
                      {type === 'studio' ? (
                        <CodeStudioIcon />
                      ) : (item as RepoUi).alreadySynced ? (
                        <div className="text-bg-success w-5 h-5">
                          <CheckIcon />
                        </div>
                      ) : type === 'local' ? (
                        <HardDrive />
                      ) : (
                        <RepositoryFilled />
                      )}
                      <span className="whitespace-nowrap">
                        {'shortName' in item ? item.shortName : item.name}
                      </span>
                    </div>
                    {'alreadySynced' in item && item.alreadySynced ? (
                      <p className="caption">
                        <Trans>Already synced</Trans>
                      </p>
                    ) : type === 'studio' ? (
                      <button
                        className={`h-8 px-2 gap-1 caption-strong opacity-0 group-row-hover:opacity-100 focus:opacity-100
                        bg-studio text-label-control py-0 rounded-4 focus:outline-none outline-none outline-0`}
                        onClick={() => {
                          handleSync((item as CodeStudioType).id);
                        }}
                      >
                        <Trans>Add context</Trans>
                      </button>
                    ) : (
                      <Button
                        variant="primary"
                        size="small"
                        className="opacity-0 group-row-hover:opacity-100 focus:opacity-100"
                        onClick={() => {
                          handleSync((item as RepoUi).ref);
                        }}
                      >
                        <Trans>Sync</Trans>
                      </Button>
                    )}
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
