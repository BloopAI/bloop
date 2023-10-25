import React, { useCallback, useContext } from 'react';
import { ArrowOut, FolderClosed } from '../../icons';
import DirEntry from '../IdeNavigation/DirEntry';
import { search } from '../../services/api';
import { buildRepoQuery } from '../../utils';
import { Directory } from '../../types/api';
import { SyncStatus } from '../../types/general';
import { AppNavigationContext } from '../../context/appNavigationContext';
import OverflowTracker from '../OverflowTracker';

type Props = {
  onClick: () => void;
  path: string;
  selectedBranch: string | null;
  repoName?: string;
};

const FolderChip = ({ onClick, path, repoName, selectedBranch }: Props) => {
  const { navigateFullResult } = useContext(AppNavigationContext);
  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await search(buildRepoQuery(repoName, path, selectedBranch));
      if (!resp.data?.[0]?.data) {
        return [];
      }
      return (resp.data[0].data as Directory)?.entries.sort((a, b) => {
        if ((a.entry_data === 'Directory') === (b.entry_data === 'Directory')) {
          return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        } else {
          return a.entry_data === 'Directory' ? -1 : 1;
        }
      });
    },
    [repoName, selectedBranch],
  );

  const navigateToPath = useCallback(
    (path: string) => {
      navigateFullResult(path);
    },
    [navigateFullResult],
  );

  return (
    <>
      <button
        className={`inline-flex items-center bg-chat-bg-shade rounded-4 overflow-hidden 
                text-label-base hover:text-label-title border border-transparent hover:border-chat-bg-border 
                cursor-pointer align-middle ellipsis`}
        onClick={onClick}
      >
        <span className="flex gap-1 px-1 py-0.5 items-center border-r border-chat-bg-border code-s ellipsis">
          <FolderClosed raw sizeClassName="w-3.5 h-3.5" />
          <span className="ellipsis">{path.slice(0, -1)}</span>
        </span>
        <span className="p-1 inline-flex items-center justify-center">
          <ArrowOut sizeClassName="w-3.5 h-3.5" />
        </span>
      </button>
      <div
        className={
          'w-full flex flex-col my-1 folder-chip text-sm border border-bg-border rounded-md overflow-auto max-h-80 p-1'
        }
      >
        <OverflowTracker className="auto-fade-vertical">
          <DirEntry
            name={path}
            isDirectory
            level={0}
            currentPath={''}
            fetchFiles={fetchFiles}
            fullPath={path}
            navigateToPath={navigateToPath}
            defaultOpen
            indexed
            repoRef={''}
            repoStatus={SyncStatus.Done}
            refetchParentFolder={() => {}}
            markRepoIndexing={() => {}}
          />
        </OverflowTracker>
      </div>
    </>
  );
};

export default FolderChip;
