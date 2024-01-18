import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import FileIcon from '../../../../components/FileIcon';
import { TabTypesEnum } from '../../../../types/general';
import { TabsContext } from '../../../../context/tabsContext';
import { DirectoryEntry, RepoFileNameItem } from '../../../../types/api';
import { FolderIcon } from '../../../../icons';
import { UIContext } from '../../../../context/uiContext';
import { getFolderContent } from '../../../../services/api';
import RepoEntry from '../../NavPanel/Repo/RepoEntry';
import { useEnterKey } from '../../../../hooks/useEnterKey';

type Props = {
  relative_path: RepoFileNameItem;
  repo_ref: string;
  is_dir: boolean;
  index: string;
  focusedIndex: string;
  isFirst: boolean;
};

const FileResult = ({
  relative_path,
  repo_ref,
  is_dir,
  index,
  focusedIndex,
  isFirst,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const ref = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState<DirectoryEntry[]>([]);

  useEffect(() => {
    if (focusedIndex === index) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, index]);

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await getFolderContent(repo_ref, path);
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
    [repo_ref],
  );

  useEffect(() => {
    if (isExpanded && !files.length) {
      fetchFiles(relative_path.text).then(setFiles);
    }
  }, [fetchFiles, files, isExpanded, relative_path.text]);

  const handleClick = useCallback(() => {
    if (is_dir) {
      setIsExpanded((prev) => !prev);
    } else {
      openNewTab({
        type: TabTypesEnum.FILE,
        path: relative_path.text,
        repoRef: repo_ref,
      });
    }
  }, [relative_path, repo_ref, is_dir, openNewTab]);

  useEnterKey(handleClick, focusedIndex !== index || !isLeftSidebarFocused);

  return (
    <span
      className={`flex flex-col flex-shrink-0 ${
        isExpanded ? '' : 'h-7 overflow-hidden'
      }`}
    >
      <span
        className={`flex items-center w-max gap-3 body-mini text-label-title h-7 flex-shrink-0 cursor-pointer  ${
          isFirst ? 'scroll-mt-10' : ''
        } scroll-ml-10 ${
          focusedIndex === index ? 'bg-bg-shade-hover' : ''
        } pl-10 pr-4`}
        ref={ref}
        data-node-index={index}
      >
        {is_dir ? (
          <FolderIcon sizeClassName="w-4 h-4" />
        ) : (
          <FileIcon filename={relative_path.text} noMargin />
        )}
        {/*<BreadcrumbsPathContainer*/}
        {/*  path={is_dir ? relative_path.text.slice(0, -1) : relative_path.text}*/}
        {/*  onClick={handleClick}*/}
        {/*  repo={repo_ref}*/}
        {/*/>*/}
        <a href="#" onClick={handleClick}>
          {relative_path.text}
        </a>
      </span>
      {isExpanded && (
        <div
          className={`-ml-3 ${
            isExpanded ? 'overflow-auto' : 'overflow-hidden'
          }`}
        >
          {files.map((f, fi) => (
            <RepoEntry
              key={f.name}
              name={f.name}
              indexed={
                f.entry_data !== 'Directory' ? f.entry_data.File.indexed : true
              }
              isDirectory={f.entry_data === 'Directory'}
              level={3}
              fetchFiles={fetchFiles}
              fullPath={f.name}
              repoRef={repo_ref}
              focusedIndex={focusedIndex}
              index={`${index}-${fi}`}
              lastIndex={''}
              isLeftSidebarFocused={isLeftSidebarFocused}
            />
          ))}
        </div>
      )}
    </span>
  );
};

export default memo(FileResult);
