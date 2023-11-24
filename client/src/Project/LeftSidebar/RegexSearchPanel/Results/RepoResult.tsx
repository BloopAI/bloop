import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import GitHubIcon from '../../../../icons/GitHubIcon';
import { HardDriveIcon } from '../../../../icons';
import { splitPath } from '../../../../utils';
import { DirectoryEntry } from '../../../../types/api';
import { getFolderContent } from '../../../../services/api';
import RepoEntry from '../../NavPanel/RepoEntry';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { UIContext } from '../../../../context/uiContext';

type Props = {
  repoRef: string;
  index: number;
  isExpandable?: boolean;
  focusedIndex: string;
};

const RepoResult = ({ repoRef, isExpandable, index, focusedIndex }: Props) => {
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState<DirectoryEntry[]>([]);

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await getFolderContent(repoRef, path);
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
    [repoRef],
  );

  useEffect(() => {
    if (isExpanded && !files.length) {
      fetchFiles().then(setFiles);
    }
  }, [fetchFiles, files, isExpanded]);

  const onClick = useCallback(() => {
    if (isExpandable) {
      setIsExpanded((prev) => !prev);
    }
  }, [isExpandable]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }
    },
    [onClick],
  );
  useKeyboardNavigation(
    handleKeyEvent,
    focusedIndex !== index.toString() || !isExpandable || !isLeftSidebarFocused,
  );

  return (
    <span
      className={`flex flex-col flex-shrink-0 ${
        isExpanded ? '' : 'h-10 overflow-hidden'
      }`}
    >
      <a
        href="#"
        className={`h-10 flex-shrink-0 ${
          isExpandable
            ? focusedIndex === index.toString()
              ? 'bg-bg-sub-hover'
              : 'bg-bg-sub hover:bg-bg-sub-hover'
            : 'bg-bg-sub'
        } flex items-center gap-3 px-4 body-s-b text-label-title`}
        onClick={onClick}
        data-node-index={isExpandable ? index : undefined}
      >
        {repoRef.startsWith('github.com/') ? (
          <GitHubIcon sizeClassName="w-3 h-3" />
        ) : (
          <HardDriveIcon sizeClassName="w-3 h-3" />
        )}
        {splitPath(repoRef)
          .slice(repoRef.startsWith('github.com/') ? -2 : -1)
          .join('/')}
      </a>
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
              focusedIndex={focusedIndex}
              index={`${index}-${fi}`}
              lastIndex={''}
            />
          ))}
        </div>
      )}
    </span>
  );
};

export default memo(RepoResult);
