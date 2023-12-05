import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Directory, DirectoryEntry } from '../../../types/api';
import { search } from '../../../services/api';
import { buildRepoQuery, splitPath } from '../../../utils';
import GitHubIcon from '../../../icons/GitHubIcon';
import Dropdown from '../../../components/Dropdown';
import {
  ArrowTriangleBottomIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
} from '../../../icons';
import Button from '../../../components/Button';
import RepoEntry from './RepoEntry';

type Props = {
  repoName: string;
  repoRef: string;
  setExpanded: Dispatch<SetStateAction<number>>;
  isExpanded: boolean;
  i: number;
};

const RepoNav = ({ repoName, repoRef, i, isExpanded, setExpanded }: Props) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<DirectoryEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await search(buildRepoQuery(repoName, path));
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
    [repoName],
  );

  const refetchParentFolder = useCallback(() => {
    fetchFiles().then(setFiles);
  }, []);

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

  return (
    <div className="select-none" ref={containerRef}>
      <span
        role="button"
        tabIndex={0}
        className={`h-10 flex items-center gap-3 px-4 bg-bg-sub ellipsis ${
          isExpanded ? 'sticky z-10 top-0 left-0' : ''
        }`}
        onClick={toggleExpanded}
      >
        {repoRef.startsWith('github.com') ? (
          <GitHubIcon sizeClassName="w-3.5 h-3.5" />
        ) : (
          <HardDriveIcon sizeClassName="w-3.5 h-3.5" />
        )}
        <div className="flex items-center gap-1 ellipsis body-s-b flex-1">
          <p className="text-label-title ellipsis">
            {splitPath(repoName).pop()}
          </p>
          <span className="text-label-muted">/</span>
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown dropdownItems={<div></div>}>
              <span className="flex items-center text-label-muted gap-1 body-s-b">
                main <ArrowTriangleBottomIcon sizeClassName="w-2 h-2" />
              </span>
            </Dropdown>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Button variant="tertiary" size="mini" onlyIcon title={t('')}>
            <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
          </Button>
        </div>
      </span>
      <div
        style={{
          maxHeight: isExpanded && files.length ? undefined : 0,
        }}
        className="overflow-hidden"
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
            repoName={repoName}
            refetchParentFolder={refetchParentFolder}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(RepoNav);
