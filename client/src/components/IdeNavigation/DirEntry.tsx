import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import { ChevronRightFilled, EyeCut, FolderClosed } from '../../icons';
import FileIcon from '../FileIcon';
import { DirectoryEntry } from '../../types/api';
import Button from '../Button';
import { forceFileToBeIndexed } from '../../services/api';
import { SyncStatus } from '../../types/general';
import LiteLoaderContainer from '../Loaders/LiteLoader';

type Props = {
  name: string;
  isDirectory: boolean;
  level: number;
  currentPath: string;
  fullPath: string;
  fetchFiles: (path: string) => Promise<DirectoryEntry[]>;
  navigateToPath: (path: string) => void;
  defaultOpen?: boolean;
  indexed: boolean;
  repoRef: string;
  repoStatus: SyncStatus;
  refetchParentFolder: () => void;
  markRepoIndexing: () => void;
};

const DirEntry = ({
  name,
  level,
  isDirectory,
  currentPath,
  fullPath,
  fetchFiles,
  navigateToPath,
  defaultOpen,
  indexed,
  repoRef,
  repoStatus,
  refetchParentFolder,
  markRepoIndexing,
}: Props) => {
  const [isOpen, setOpen] = useState(
    defaultOpen || (currentPath && currentPath.startsWith(fullPath)),
  );
  const [indexRequested, setIndexRequested] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [subItems, setSubItems] = useState<DirectoryEntry[] | null>(null);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (
      [
        SyncStatus.Indexing,
        SyncStatus.Queued,
        SyncStatus.Syncing,
        SyncStatus.Indexing,
      ].includes(repoStatus) &&
      ((subItems?.some(
        (si) => si.entry_data !== 'Directory' && !si.entry_data.File.indexed,
      ) &&
        isOpen) ||
        (!isDirectory && !indexed))
    ) {
      setIsIndexing(true);
    } else if (isIndexing && repoStatus === SyncStatus.Done) {
      setTimeout(() => {
        if (!isOpen || !isDirectory) {
          refetchParentFolder();
        } else {
          refetchFolderFiles();
        }
        setIsIndexing(false);
        setIndexRequested(false);
      }, 500);
    }
  }, [
    repoStatus,
    isIndexing,
    refetchParentFolder,
    subItems,
    isOpen,
    isDirectory,
  ]);

  useEffect(() => {
    if (currentPath && currentPath.startsWith(fullPath)) {
      setOpen(true);
    }
    if (currentPath === fullPath) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentPath, fullPath]);

  const refetchFolderFiles = useCallback(() => {
    fetchFiles(fullPath).then(setSubItems);
  }, [fullPath]);

  useEffect(() => {
    if (isDirectory && isOpen && !subItems) {
      fetchFiles(fullPath).then(setSubItems);
    }
  }, [isOpen, isDirectory, subItems, refetchFolderFiles]);

  const handleClick = useCallback(() => {
    if (isDirectory) {
      setOpen((prev) => !prev);
    } else {
      navigateToPath(fullPath);
    }
  }, [isDirectory, fullPath, navigateToPath]);

  const onIndexRequested = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      forceFileToBeIndexed(repoRef, fullPath);
      setIndexRequested(true);
      markRepoIndexing();
    },
    [fullPath, repoRef, markRepoIndexing],
  );

  return (
    <div
      style={{
        maxHeight: isOpen && subItems ? undefined : 28,
      }}
      className="flex flex-col transition-all ease-linear overflow-hidden flex-shrink-0 w-full min-w-fit"
    >
      <a
        className={`min-w-full w-max text-left h-7 flex-shrink-0 flex items-center gap-1.5 py-2 px-3 cursor-pointer caption group
      ${
        currentPath === fullPath
          ? 'bg-bg-main/15 text-label-title'
          : 'hover:bg-bg-base-hover hover:text-label-title active:bg-transparent'
      } ${
        isOpen && isDirectory
          ? 'text-label-title'
          : indexed
          ? 'text-label-base'
          : 'text-label-muted'
      }`}
        style={{ paddingLeft: level * 26 }}
        onClick={handleClick}
        ref={ref}
      >
        {isDirectory ? (
          <ChevronRightFilled
            className={`${
              isOpen ? 'transform rotate-90' : ''
            } transition-all duration-200`}
          />
        ) : null}
        {isDirectory ? (
          <FolderClosed raw sizeClassName="w-4 h-4" />
        ) : indexed ? (
          <FileIcon filename={name} />
        ) : (
          <EyeCut />
        )}
        {isDirectory ? name.slice(0, -1) : name}
        {!indexed && !indexRequested && (
          <Button
            variant="secondary"
            size="tiny"
            onClick={onIndexRequested}
            className="opacity-0 group-hover:opacity-100 transform scale-75 transition-opacity ease-in-out duration-150"
          >
            <Trans>Index</Trans>
          </Button>
        )}
        {!indexed && indexRequested && isIndexing && (
          <div className="text-bg-main">
            <LiteLoaderContainer sizeClassName="w-4 h-4" />
          </div>
        )}
      </a>
      {subItems?.length ? (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-2 w-px bg-bg-border"
            style={{ left: level * 26 + 10 }}
          />
          {subItems.map((si) => (
            <DirEntry
              key={name + si.name}
              name={si.name}
              isDirectory={si.entry_data === 'Directory'}
              level={level + 1}
              currentPath={currentPath}
              fetchFiles={fetchFiles}
              fullPath={fullPath + si.name}
              navigateToPath={navigateToPath}
              indexed={
                si.entry_data !== 'Directory'
                  ? si.entry_data.File.indexed
                  : true
              }
              repoRef={repoRef}
              repoStatus={repoStatus}
              refetchParentFolder={refetchFolderFiles}
              markRepoIndexing={markRepoIndexing}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default memo(DirEntry);
