import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DirectoryEntry } from '../../../types/api';
import { getFolderContent } from '../../../services/api';
import { splitPath } from '../../../utils';
import GitHubIcon from '../../../icons/GitHubIcon';
import Dropdown from '../../../components/Dropdown';
import {
  ArrowTriangleBottomIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
} from '../../../icons';
import Button from '../../../components/Button';
import { SyncStatus } from '../../../types/general';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import Tooltip from '../../../components/Tooltip';
import { repoStatusMap } from '../../../consts/general';
import RepoEntry from './RepoEntry';
import RepoDropdown from './RepoDropdown';

type Props = {
  repoRef: string;
  setExpanded: Dispatch<SetStateAction<number>>;
  isExpanded: boolean;
  i: number;
  projectId: string;
  lastIndex: string;
  currentPath?: string;
  branch: string;
  allBranches: { name: string; last_commit_unix_secs: number }[];
  indexedBranches: string[];
  indexingData?: { status: SyncStatus; percentage?: string; branch?: string };
};

const reactRoot = document.getElementById('root')!;

const RepoNav = ({
  repoRef,
  i,
  isExpanded,
  setExpanded,
  branch,
  indexedBranches,
  allBranches,
  projectId,
  lastIndex,
  currentPath,
  indexingData,
}: Props) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await getFolderContent(repoRef, path, branch);
      if (!resp.entries) {
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
    [repoRef, branch],
  );

  const refetchParentFolder = useCallback(() => {
    fetchFiles().then(setFiles);
  }, [fetchFiles]);

  useEffect(() => {
    refetchParentFolder();
  }, [refetchParentFolder]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => (prev === i ? -1 : i));
  }, [i]);

  useEffect(() => {
    if (isExpanded) {
      // containerRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isExpanded]);

  const dropdownComponentProps = useMemo(() => {
    return {
      key: repoRef,
      projectId,
      repoRef,
      selectedBranch: branch,
      indexedBranches,
      allBranches,
    };
  }, [projectId, repoRef, branch, indexedBranches, allBranches]);

  const noPropagate = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
  }, []);

  const isIndexing = useMemo(() => {
    if (!indexingData) {
      return false;
    }
    return [
      SyncStatus.Indexing,
      SyncStatus.Syncing,
      SyncStatus.Queued,
    ].includes(indexingData.status);
  }, [indexingData]);

  return (
    <div className="select-none flex-shrink-0" ref={containerRef}>
      <span
        role="button"
        tabIndex={0}
        className={`h-10 flex items-center gap-3 px-4 bg-bg-sub ellipsis ${
          isExpanded ? 'sticky z-10 top-0 left-0' : ''
        }`}
        onClick={toggleExpanded}
      >
        {isIndexing && indexingData ? (
          <Tooltip
            text={`${t(repoStatusMap[indexingData.status].text)}${
              indexingData?.percentage ? ` · ${indexingData?.percentage}%` : ''
            }`}
            placement="bottom-start"
          >
            <SpinLoaderContainer
              sizeClassName="w-3.5 h-3.5"
              colorClassName="text-blue"
            />
          </Tooltip>
        ) : repoRef.startsWith('github.com') ? (
          <GitHubIcon sizeClassName="w-3.5 h-3.5" />
        ) : (
          <HardDriveIcon sizeClassName="w-3.5 h-3.5" />
        )}
        <p className="flex items-center gap-1 body-s-b flex-1 ellipsis">
          <span className="text-label-title">{splitPath(repoRef).pop()}</span>
          {isExpanded && (
            <>
              <span className="text-label-muted">/</span>
              <span className="flex items-center text-label-muted gap-1 body-s-b">
                {branch?.replace(/^origin\//, '')}{' '}
                <ArrowTriangleBottomIcon sizeClassName="w-2 h-2" />
              </span>
            </>
          )}
        </p>
        {isExpanded && (
          <div onClick={noPropagate}>
            <Dropdown
              DropdownComponent={RepoDropdown}
              dropdownComponentProps={dropdownComponentProps}
              appendTo={reactRoot}
              dropdownPlacement="bottom-start"
            >
              <Button
                variant="tertiary"
                size="mini"
                onlyIcon
                title={t('More actions')}
              >
                <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
              </Button>
            </Dropdown>
          </div>
        )}
      </span>
      <div
        style={{
          maxHeight: isExpanded && files.length ? undefined : 0,
        }}
        className={isExpanded ? 'overflow-auto' : 'overflow-hidden'}
      >
        {files.map((f) => (
          <RepoEntry
            key={f.name}
            name={f.name}
            indexed={
              f.entry_data !== 'Directory' ? f.entry_data.File.indexed : true
            }
            isDirectory={f.entry_data === 'Directory'}
            level={1}
            fetchFiles={fetchFiles}
            fullPath={f.name}
            repoRef={repoRef}
            currentPath={currentPath}
            lastIndex={lastIndex}
            branch={branch}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(RepoNav);
