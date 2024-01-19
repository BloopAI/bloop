import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChevronRightIcon, EyeCutIcon, FolderIcon } from '../../../../icons';
import FileIcon from '../../../../components/FileIcon';
import { DirectoryEntry } from '../../../../types/api';
import { TabsContext } from '../../../../context/tabsContext';
import {
  RepoIndexingStatusType,
  SyncStatus,
  TabTypesEnum,
} from '../../../../types/general';
import SpinLoaderContainer from '../../../../components/Loaders/SpinnerLoader';
import { useEnterKey } from '../../../../hooks/useEnterKey';

type Props = {
  name: string;
  isDirectory: boolean;
  level: number;
  fullPath: string;
  fetchFiles: (path: string) => Promise<DirectoryEntry[]>;
  defaultOpen?: boolean;
  indexed: boolean;
  repoRef: string;
  lastIndex: string;
  currentPath?: string;
  branch?: string | null;
  indexingData?: RepoIndexingStatusType;
  focusedIndex: string;
  index: string;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
};

const RepoEntry = ({
  name,
  level,
  isDirectory,
  currentPath,
  fullPath,
  fetchFiles,
  defaultOpen,
  indexed,
  repoRef,
  lastIndex,
  branch,
  indexingData,
  focusedIndex,
  index,
  isLeftSidebarFocused,
  isCommandBarVisible,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [isOpen, setOpen] = useState(
    defaultOpen || (currentPath && currentPath.startsWith(fullPath)),
  );
  const [subItems, setSubItems] = useState<DirectoryEntry[] | null>(null);
  const ref = useRef<HTMLAnchorElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  const refetchFolderFiles = useCallback(() => {
    fetchFiles(fullPath).then(setSubItems);
  }, [fullPath, fetchFiles]);

  useEffect(() => {
    if (indexingData?.status === SyncStatus.Done && isDirectory) {
      refetchFolderFiles();
    }
  }, [indexingData?.status]);

  useEffect(() => {
    if (currentPath && currentPath.startsWith(fullPath)) {
      setOpen(true);
    }
  }, [currentPath, fullPath]);

  useEffect(() => {
    if (
      subItems?.length &&
      subItems.find(
        (si) => si.entry_data !== 'Directory' && !si.entry_data.File.indexed,
      ) &&
      isMounted
    ) {
      refetchFolderFiles();
    } else {
      setIsMounted(true);
    }
  }, [lastIndex]);

  useEffect(() => {
    if (isDirectory && isOpen) {
      refetchFolderFiles();
    }
  }, [isOpen, isDirectory, refetchFolderFiles]);

  const handleClick = useCallback(() => {
    if (isDirectory) {
      setOpen((prev) => !prev);
    } else {
      openNewTab({
        type: TabTypesEnum.FILE,
        path: fullPath,
        repoRef,
        branch,
      });
    }
  }, [isDirectory, fullPath, openNewTab, repoRef, branch]);

  useEnterKey(
    handleClick,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  useEffect(() => {
    if (focusedIndex === index && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, index]);

  return (
    <div
      style={{
        maxHeight: isOpen && subItems ? undefined : 28,
      }}
      className="flex flex-col transition-all ease-linear overflow-hidden flex-shrink-0 w-full min-w-fit"
    >
      <a
        className={`min-w-full w-max text-left h-7 flex-shrink-0 flex items-center gap-3 px-4 cursor-pointer body-mini group
      ${
        currentPath === fullPath
          ? isLeftSidebarFocused
            ? 'bg-bg-shade-hover text-label-title'
            : 'bg-bg-shade text-label-title'
          : isLeftSidebarFocused && focusedIndex === index
          ? 'bg-bg-sub-hover text-label-title'
          : 'hover:bg-bg-base-hover hover:text-label-title active:bg-transparent'
      } ${
        isOpen && isDirectory
          ? 'text-label-title'
          : indexed
          ? 'text-label-base'
          : 'text-label-muted'
      }`}
        style={{ paddingLeft: level * 27 }}
        onClick={handleClick}
        ref={ref}
        data-node-index={index}
      >
        {isDirectory ? (
          <div className="w-4 h-4 flex items-center justify-center">
            <ChevronRightIcon
              sizeClassName="w-3.5 h-3.5"
              className={`${
                isOpen
                  ? 'transform rotate-90 text-label-base'
                  : 'text-label-muted'
              } transition-all duration-200`}
            />
          </div>
        ) : null}
        {isDirectory ? (
          <FolderIcon sizeClassName="w-4 h-4" />
        ) : !indexed ? (
          indexingData?.status === SyncStatus.Indexing ? (
            <SpinLoaderContainer sizeClassName="w-4 h-4" />
          ) : (
            <EyeCutIcon sizeClassName="w-4 h-4" />
          )
        ) : (
          <FileIcon filename={name} noMargin />
        )}
        {isDirectory ? name.slice(0, -1) : name}
        {/*{!indexed && !indexRequested && (*/}
        {/*  <Button*/}
        {/*    variant="secondary"*/}
        {/*    size="tiny"*/}
        {/*    onClick={onIndexRequested}*/}
        {/*    className="opacity-0 group-hover:opacity-100 transform scale-75 transition-opacity ease-in-out duration-150"*/}
        {/*  >*/}
        {/*    <Trans>Index</Trans>*/}
        {/*  </Button>*/}
        {/*)}*/}
        {/*{!indexed && indexRequested && isIndexing && (*/}
        {/*  <div className="text-bg-main">*/}
        {/*    <LiteLoaderContainer sizeClassName="w-4 h-4" />*/}
        {/*  </div>*/}
        {/*)}*/}
      </a>
      {isOpen && subItems?.length ? (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-2 w-px bg-bg-border"
            style={{ left: level * 27 + 8 }}
          />
          {subItems.map((si, sii) => (
            <RepoEntry
              key={name + si.name}
              name={si.name}
              isDirectory={si.entry_data === 'Directory'}
              level={level + 1}
              fetchFiles={fetchFiles}
              fullPath={fullPath + si.name}
              indexed={
                si.entry_data !== 'Directory'
                  ? si.entry_data.File.indexed
                  : true
              }
              repoRef={repoRef}
              lastIndex={lastIndex}
              currentPath={currentPath}
              branch={branch}
              focusedIndex={focusedIndex}
              index={`${index}-${sii}`}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default memo(RepoEntry);
