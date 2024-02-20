import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import FileIcon from '../../../../components/FileIcon';
import { TabTypesEnum } from '../../../../types/general';
import { TabsContext } from '../../../../context/tabsContext';
import { DirectoryEntry, RepoFileNameItem } from '../../../../types/api';
import { FolderIcon } from '../../../../icons';
import { getFolderContent } from '../../../../services/api';
import RepoEntry from '../../NavPanel/Repo/RepoEntry';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';

type Props = {
  relative_path: RepoFileNameItem;
  repo_ref: string;
  is_dir: boolean;
  index: string;
  isFirst: boolean;
};

const FileResult = ({
  relative_path,
  repo_ref,
  is_dir,
  index,
  isFirst,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState<DirectoryEntry[]>([]);

  const fetchFiles = useCallback(
    async (path?: string) => {
      const resp = await getFolderContent(repo_ref, path);
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
    [repo_ref],
  );

  useEffect(() => {
    if (isExpanded && !files.length) {
      fetchFiles(relative_path.text).then(setFiles);
    }
  }, [fetchFiles, files, isExpanded, relative_path.text]);

  const onClick = useCallback(() => {
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

  const { isFocused, props } = useArrowNavigationItemProps(index, onClick);

  return (
    <span
      className={`flex flex-col flex-shrink-0 ${
        isExpanded ? '' : 'h-7 overflow-hidden'
      }`}
    >
      <span
        className={`flex items-center w-max gap-3 body-mini text-label-title h-7 flex-shrink-0 cursor-pointer  ${
          isFirst ? 'scroll-mt-10' : ''
        } scroll-ml-10 ${isFocused ? 'bg-bg-shade-hover' : ''} pl-10 pr-4`}
        {...props}
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
        <span>{relative_path.text}</span>
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
              index={`${index}-${fi}`}
              lastIndex={''}
            />
          ))}
        </div>
      )}
    </span>
  );
};

export default memo(FileResult);
