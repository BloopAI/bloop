import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DirectoryEntry } from '../../../../types/api';
import { getFolderContent } from '../../../../services/api';
import { splitPath } from '../../../../utils';
import GitHubIcon from '../../../../icons/GitHubIcon';
import Dropdown from '../../../../components/Dropdown';
import {
  ArrowTriangleBottomIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
} from '../../../../icons';
import Button from '../../../../components/Button';
import { RepoIndexingStatusType, SyncStatus } from '../../../../types/general';
import SpinLoaderContainer from '../../../../components/Loaders/SpinnerLoader';
import Tooltip from '../../../../components/Tooltip';
import { repoStatusMap } from '../../../../consts/general';
import { useNavPanel } from '../../../../hooks/useNavPanel';
import RepoEntry from './RepoEntry';
import RepoDropdown from './RepoDropdown';

type Props = {
  repoRef: string;
  setExpanded: Dispatch<SetStateAction<string>>;
  isExpanded: boolean;
  projectId: string;
  lastIndex: string;
  currentPath?: string;
  branch: string;
  allBranches: { name: string; last_commit_unix_secs: number }[];
  indexedBranches: string[];
  indexingData?: RepoIndexingStatusType;
  index: string;
};

const reactRoot = document.getElementById('root')!;

const RepoNav = ({
  repoRef,
  isExpanded,
  setExpanded,
  branch,
  indexedBranches,
  allBranches,
  projectId,
  lastIndex,
  currentPath,
  indexingData,
  index,
}: Props) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const { noPropagate, itemProps } = useNavPanel(
    index,
    setExpanded,
    isExpanded,
  );

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await getFolderContent(repoRef, path, branch);
      if (!resp.entries) {
        return [];
      }
      return resp?.entries.sort((a, b) => {
        if ((a.entry_data === 'Directory') === (b.entry_data === 'Directory')) {
          return a.name?.toLowerCase() < b.name?.toLowerCase() ? -1 : 1;
        } else {
          return a.entry_data === 'Directory' ? -1 : 1;
        }
      });
    },
    [repoRef, branch, indexingData?.status],
  );

  const refetchParentFolder = useCallback(() => {
    fetchFiles().then(setFiles);
  }, [fetchFiles]);

  useEffect(() => {
    refetchParentFolder();
  }, [refetchParentFolder]);

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
    <div className="select-none flex-shrink-0">
      <span {...itemProps}>
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
      {isExpanded && (
        <div className={isExpanded ? 'overflow-auto' : 'overflow-hidden'}>
          {files.map((f, fi) => (
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
              indexingData={indexingData}
              index={`${index}-${fi}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(RepoNav);
