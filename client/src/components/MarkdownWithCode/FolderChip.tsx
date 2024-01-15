import React, { useCallback } from 'react';
import { ArrowOutIcon, FolderIcon } from '../../icons';
import { getFolderContent } from '../../services/api';
import OverflowTracker from '../OverflowTracker';
import RepoEntry from '../../Project/LeftSidebar/NavPanel/RepoEntry';

type Props = {
  onClick: () => void;
  path: string;
  repoRef?: string;
};

const FolderChip = ({ onClick, path, repoRef }: Props) => {
  const fetchFiles = useCallback(
    async (path?: string) => {
      if (!repoRef) {
        return [];
      }
      const resp = await getFolderContent(repoRef, path);
      if (!resp.entries?.length) {
        return [];
      }
      return resp?.entries.sort((a, b) => {
        if ((a.entry_data === 'Directory') === (b.entry_data === 'Directory')) {
          return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        } else {
          return a.entry_data === 'Directory' ? -1 : 1;
        }
      });
    },
    [repoRef],
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
          <FolderIcon raw sizeClassName="w-3.5 h-3.5" />
          <span className="ellipsis">{path.slice(0, -1)}</span>
        </span>
        <span className="p-1 inline-flex items-center justify-center">
          <ArrowOutIcon sizeClassName="w-3.5 h-3.5" />
        </span>
      </button>
      <div
        className={
          'w-full flex flex-col my-1 folder-chip text-sm border border-bg-border rounded-md overflow-auto max-h-80 p-1'
        }
      >
        <OverflowTracker className="auto-fade-vertical">
          <RepoEntry
            name={path}
            isDirectory
            level={0}
            fetchFiles={fetchFiles}
            fullPath={path}
            defaultOpen
            indexed
            repoRef={repoRef || ''}
            lastIndex={''}
            focusedIndex={''}
            index={'0'}
          />
        </OverflowTracker>
      </div>
    </>
  );
};

export default FolderChip;
